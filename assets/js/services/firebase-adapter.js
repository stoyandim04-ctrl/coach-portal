/**
 * Firebase adapter — Auth (email/password) + Firestore + Storage, loaded from the official CDN.
 * Only imported when APP_CONFIG.backend === 'firebase'. Security rules: firestore.rules / storage.rules.
 *
 * Collections:
 *   coaches/{uid}            { name, email, createdAt }
 *   clients/{id}             { coachId, name, email, goal, token, createdAt }
 *   checkinLinks/{token}     { clientId, coachId, clientName, coachName }   ← publicly readable by exact token
 *   checkins/{id}            { token, clientId, coachId, clientName, weight, sleep, energy,
 *                              measurements, comment, photos: { front|side|back: storagePath },
 *                              coachNote, createdAt }
 * Storage:
 *   checkins/{token}/{checkinId}/{slot}.jpg
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { AppError, uid } from '../lib/utils.js';
import { validateRegistration, validateClient, validateCheckin, summarizeClient, PHOTO_SLOTS } from '../lib/model.js';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Грешен имейл или парола.',
  'auth/wrong-password': 'Грешен имейл или парола.',
  'auth/user-not-found': 'Грешен имейл или парола.',
  'auth/email-already-in-use': 'Вече има акаунт с този имейл. Опитайте вход.',
  'auth/invalid-email': 'Въведете валиден имейл адрес.',
  'auth/weak-password': 'Паролата трябва да е поне 6 символа.',
  'auth/too-many-requests': 'Твърде много опити. Изчакайте малко и опитайте отново.',
  'auth/network-request-failed': 'Няма връзка с интернет.',
  'permission-denied': 'Нямате достъп до този ресурс.',
  'storage/unauthorized': 'Нямате права за качване на снимки.',
  unavailable: 'Услугата е временно недостъпна. Опитайте отново.',
};

function toAppError(err) {
  if (err instanceof AppError) return err;
  console.error('[FitCheck/firebase]', err);
  return new AppError(err?.code ?? 'unknown', ERROR_MESSAGES[err?.code] ?? 'Възникна грешка. Опитайте отново.');
}

/** Wraps every adapter method so callers only ever see AppError. */
const guarded = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    throw toAppError(err);
  }
};

export function createAdapter(config) {
  const app = initializeApp(config.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const authReady = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); });
  });

  async function requireUser() {
    await authReady;
    if (!auth.currentUser) throw new AppError('auth/required', 'Сесията е изтекла. Моля, влезте отново.');
    return auth.currentUser;
  }

  async function ownedClient(user, clientId) {
    const snap = await getDoc(doc(db, 'clients', clientId));
    if (!snap.exists() || snap.data().coachId !== user.uid) throw new AppError('not-found', 'Клиентът не е намерен.');
    return { id: snap.id, ...snap.data() };
  }

  const coachCheckins = (user, extra = []) =>
    getDocs(query(collection(db, 'checkins'), where('coachId', '==', user.uid), ...extra))
      .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));

  async function resolvePhotos(checkin) {
    const photos = {};
    await Promise.all(Object.entries(checkin.photos ?? {}).map(async ([slot, path]) => {
      try { photos[slot] = await getDownloadURL(ref(storage, path)); } catch { /* deleted / missing */ }
    }));
    return { ...checkin, photos };
  }

  async function loadCoachProfile(user) {
    const snap = await getDoc(doc(db, 'coaches', user.uid));
    return { id: user.uid, name: snap.data()?.name ?? user.displayName ?? '', email: user.email };
  }

  return {
    kind: 'firebase',
    photoOptions: { maxSize: 1440, quality: 0.8 },

    async init() {
      await authReady;
    },

    register: guarded(async (input) => {
      const { name, email, password } = validateRegistration(input);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'coaches', user.uid), { name, email, createdAt: Date.now() });
      return { id: user.uid, name, email };
    }),

    login: guarded(async ({ email, password }) => {
      const { user } = await signInWithEmailAndPassword(auth, String(email).trim(), String(password));
      return loadCoachProfile(user);
    }),

    logout: guarded(() => signOut(auth)),

    getCurrentCoach: guarded(async () => {
      await authReady;
      return auth.currentUser ? loadCoachProfile(auth.currentUser) : null;
    }),

    listClients: guarded(async () => {
      const user = await requireUser();
      const [clientSnap, checkins] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('coachId', '==', user.uid))),
        coachCheckins(user),
      ]);
      return clientSnap.docs.map((d) => summarizeClient({ id: d.id, ...d.data() }, checkins.filter((c) => c.clientId === d.id)));
    }),

    createClient: guarded(async (input) => {
      const data = validateClient(input);
      const user = await requireUser();
      const coach = await loadCoachProfile(user);
      const clientRef = doc(collection(db, 'clients'));
      const client = { coachId: user.uid, ...data, token: uid(24), createdAt: Date.now() };

      const batch = writeBatch(db);
      batch.set(clientRef, client);
      batch.set(doc(db, 'checkinLinks', client.token), { clientId: clientRef.id, coachId: user.uid, clientName: data.name, coachName: coach.name });
      await batch.commit();
      return summarizeClient({ id: clientRef.id, ...client }, []);
    }),

    getClient: guarded(async (clientId) => {
      const user = await requireUser();
      const client = await ownedClient(user, clientId);
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);
      return summarizeClient(client, checkins);
    }),

    deleteClient: guarded(async (clientId) => {
      const user = await requireUser();
      const client = await ownedClient(user, clientId);
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);

      // Photos first: storage rules check ownership through the link document.
      await Promise.allSettled(checkins.flatMap((c) => Object.values(c.photos ?? {}).map((p) => deleteObject(ref(storage, p)))));

      const batch = writeBatch(db);
      checkins.forEach((c) => batch.delete(doc(db, 'checkins', c.id)));
      batch.delete(doc(db, 'checkinLinks', client.token));
      batch.delete(doc(db, 'clients', clientId));
      await batch.commit();
    }),

    listCheckins: guarded(async (clientId) => {
      const user = await requireUser();
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);
      const resolved = await Promise.all(checkins.map(resolvePhotos));
      return resolved.sort((a, b) => b.createdAt - a.createdAt);
    }),

    updateCoachNote: guarded(async (checkinId, note) => {
      await requireUser();
      const patch = { coachNote: String(note ?? '').trim().slice(0, 2000), coachNoteAt: Date.now() };
      await updateDoc(doc(db, 'checkins', checkinId), patch);
      return { id: checkinId, ...patch };
    }),

    getCheckinContext: guarded(async (token) => {
      if (!token) return null;
      const snap = await getDoc(doc(db, 'checkinLinks', token));
      return snap.exists() ? snap.data() : null;
    }),

    submitCheckin: guarded(async (token, payload) => {
      const data = validateCheckin(payload);
      const linkSnap = await getDoc(doc(db, 'checkinLinks', token));
      if (!linkSnap.exists()) throw new AppError('link/invalid', 'Линкът за чек-ин е невалиден или изтрит.');
      const link = linkSnap.data();

      const checkinRef = doc(collection(db, 'checkins'));
      const photos = {};
      await Promise.all(PHOTO_SLOTS.map(async ({ key }) => {
        const blob = payload.photos?.[key]?.blob;
        if (!blob) return;
        const path = `checkins/${token}/${checkinRef.id}/${key}.jpg`;
        await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
        photos[key] = path;
      }));

      const checkin = { token, clientId: link.clientId, coachId: link.coachId, ...data, photos, createdAt: Date.now() };
      await setDoc(checkinRef, checkin);
      return { id: checkinRef.id, ...checkin };
    }),
  };
}
