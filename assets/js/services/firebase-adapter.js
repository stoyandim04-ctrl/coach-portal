/**
 * Firebase adapter — Auth (email/password) + Firestore + Storage, loaded from the official CDN.
 * Only imported when APP_CONFIG.backend === 'firebase'. Security rules: firestore.rules / storage.rules.
 *
 * Collections:
 *   users/{uid}              { name, email, role: 'coach' | 'client', createdAt }      (role is immutable)
 *   clients/{id}             { coachId, name, email, goal, token, program, userId?, createdAt }
 *   checkinLinks/{token}     { clientId, coachId, clientName, coachName, clientUserId? }   ← readable by exact token
 *   checkins/{id}            { token, clientId, coachId, clientUserId?, clientName, weight, sleep, energy,
 *                              stress?, hunger?, adherence?, performance?, measurements, comment,
 *                              photos: { front|side|back: storagePath }, coachNote, createdAt }
 *   clientNotes/{clientId}   { coachId, text, updatedAt }                               (coach-only)
 * Storage:
 *   checkins/{token}/{checkinId}/{slot}.jpg
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

import { AppError, uid } from '../lib/utils.js';
import {
  ROLES, PHOTO_SLOTS, validateRegistration, validateClient, validateCheckin, summarizeClient, normalizeProgram,
} from '../lib/model.js';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'Грешен имейл или парола.',
  'auth/wrong-password': 'Грешен имейл или парола.',
  'auth/user-not-found': 'Грешен имейл или парола.',
  'auth/email-already-in-use': 'Вече има акаунт с този имейл. Опитайте вход.',
  'auth/invalid-email': 'Въведете валиден имейл.',
  'auth/weak-password': 'Паролата трябва да е поне 6 символа.',
  'auth/too-many-requests': 'Твърде много опити. Изчакайте малко и опитайте отново.',
  'auth/network-request-failed': 'Няма връзка с интернет.',
  'permission-denied': 'Нямате достъп до този ресурс.',
  'storage/unauthorized': 'Нямате права за качване на снимки.',
  unavailable: 'Услугата е временно недостъпна. Опитайте отново.',
};

function toAppError(err) {
  if (err instanceof AppError) return err;
  console.error('[Coach Portal/firebase]', err);
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

const withId = (snap) => ({ id: snap.id, ...snap.data() });

export function createAdapter(config) {
  const app = initializeApp(config.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  const authReady = new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user); });
  });

  async function profile(user) {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { id: user.uid, name: data.name ?? user.displayName ?? '', email: user.email, role: data.role, createdAt: data.createdAt };
  }

  async function requireUser(role) {
    await authReady;
    const user = auth.currentUser;
    if (!user) throw new AppError('auth/required', 'Сесията е изтекла. Влезте отново.');
    if (role) {
      const p = await profile(user);
      if (p?.role !== role) throw new AppError('auth/role', 'Нямате достъп до тази страница.');
    }
    return user;
  }

  async function ownedClient(user, clientId) {
    const snap = await getDoc(doc(db, 'clients', clientId));
    if (!snap.exists() || snap.data().coachId !== user.uid) throw new AppError('not-found', 'Клиентът не е намерен.');
    return withId(snap);
  }

  const coachCheckins = (user, extra = []) =>
    getDocs(query(collection(db, 'checkins'), where('coachId', '==', user.uid), ...extra)).then((s) => s.docs.map(withId));

  async function resolvePhotos(checkin) {
    const photos = {};
    await Promise.all(Object.entries(checkin.photos ?? {}).map(async ([slot, path]) => {
      try { photos[slot] = await getDownloadURL(ref(storage, path)); } catch { /* deleted / missing */ }
    }));
    return { ...checkin, photos };
  }

  async function myClientDoc(user) {
    const snap = await getDocs(query(collection(db, 'clients'), where('userId', '==', user.uid), limit(1)));
    return snap.empty ? null : withId(snap.docs[0]);
  }

  async function coachNameOf(coachId, fallbackLink) {
    // Clients can't read the coach's user doc; the link carries the display name.
    if (fallbackLink?.coachName) return fallbackLink.coachName;
    return '';
  }

  return {
    kind: 'firebase',
    photoOptions: { maxSize: 1440, quality: 0.8 },

    async init() {
      await authReady;
    },

    /* ---------- Auth ---------- */

    register: guarded(async (input) => {
      const { name, email, password, role } = validateRegistration(input);
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), { name, email, role, createdAt: Date.now() });
      return { id: user.uid, name, email, role };
    }),

    login: guarded(async ({ email, password }) => {
      const { user } = await signInWithEmailAndPassword(auth, String(email).trim(), String(password));
      const p = await profile(user);
      if (!p) throw new AppError('auth/no-profile', 'Акаунтът няма профил. Свържете се с поддръжката.');
      return p;
    }),

    logout: guarded(() => signOut(auth)),

    getCurrentUser: guarded(async () => {
      await authReady;
      return auth.currentUser ? profile(auth.currentUser) : null;
    }),

    /* ---------- Coach ---------- */

    listClients: guarded(async () => {
      const user = await requireUser(ROLES.coach);
      const [clientSnap, checkins] = await Promise.all([
        getDocs(query(collection(db, 'clients'), where('coachId', '==', user.uid))),
        coachCheckins(user),
      ]);
      return clientSnap.docs.map((d) => {
        const c = withId(d);
        return { ...summarizeClient(c, checkins.filter((k) => k.clientId === d.id)), claimed: Boolean(c.userId) };
      });
    }),

    createClient: guarded(async (input) => {
      const data = validateClient(input);
      const user = await requireUser(ROLES.coach);
      const coach = await profile(user);
      const clientRef = doc(collection(db, 'clients'));
      const client = { coachId: user.uid, ...data, token: uid(24), program: normalizeProgram(null), createdAt: Date.now() };

      const batch = writeBatch(db);
      batch.set(clientRef, client);
      batch.set(doc(db, 'checkinLinks', client.token), { clientId: clientRef.id, coachId: user.uid, clientName: data.name, coachName: coach?.name ?? '' });
      await batch.commit();
      return { ...summarizeClient({ id: clientRef.id, ...client }, []), claimed: false };
    }),

    getClient: guarded(async (clientId) => {
      const user = await requireUser(ROLES.coach);
      const client = await ownedClient(user, clientId);
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);
      return { ...summarizeClient(client, checkins), claimed: Boolean(client.userId) };
    }),

    deleteClient: guarded(async (clientId) => {
      const user = await requireUser(ROLES.coach);
      const client = await ownedClient(user, clientId);
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);

      // Photos first: storage rules check ownership through the link document.
      await Promise.allSettled(checkins.flatMap((c) => Object.values(c.photos ?? {}).map((p) => deleteObject(ref(storage, p)))));

      const batch = writeBatch(db);
      checkins.forEach((c) => batch.delete(doc(db, 'checkins', c.id)));
      batch.delete(doc(db, 'checkinLinks', client.token));
      batch.delete(doc(db, 'clientNotes', clientId));
      batch.delete(doc(db, 'clients', clientId));
      await batch.commit();
    }),

    listCheckins: guarded(async (clientId) => {
      const user = await requireUser(ROLES.coach);
      const checkins = await coachCheckins(user, [where('clientId', '==', clientId)]);
      const resolved = await Promise.all(checkins.map(resolvePhotos));
      return resolved.sort((a, b) => b.createdAt - a.createdAt);
    }),

    listCoachCheckins: guarded(async () => {
      const user = await requireUser(ROLES.coach);
      return (await coachCheckins(user)).sort((a, b) => b.createdAt - a.createdAt);
    }),

    updateCoachNote: guarded(async (checkinId, note) => {
      await requireUser(ROLES.coach);
      const patch = { coachNote: String(note ?? '').trim().slice(0, 2000), coachNoteAt: Date.now() };
      await updateDoc(doc(db, 'checkins', checkinId), patch);
      return { id: checkinId, ...patch };
    }),

    updateProgram: guarded(async (clientId, program) => {
      const user = await requireUser(ROLES.coach);
      await ownedClient(user, clientId);
      const clean = normalizeProgram(program);
      await updateDoc(doc(db, 'clients', clientId), { program: clean });
      return clean;
    }),

    getClientNotes: guarded(async (clientId) => {
      const user = await requireUser(ROLES.coach);
      await ownedClient(user, clientId);
      const snap = await getDoc(doc(db, 'clientNotes', clientId));
      return snap.exists() ? { text: snap.data().text ?? '', updatedAt: snap.data().updatedAt ?? null } : { text: '', updatedAt: null };
    }),

    saveClientNotes: guarded(async (clientId, text) => {
      const user = await requireUser(ROLES.coach);
      await ownedClient(user, clientId);
      const data = { coachId: user.uid, text: String(text ?? '').slice(0, 10000), updatedAt: Date.now() };
      await setDoc(doc(db, 'clientNotes', clientId), data);
      return data;
    }),

    /* ---------- Client ---------- */

    getMyClient: guarded(async () => {
      const user = await requireUser(ROLES.client);
      const client = await myClientDoc(user);
      if (!client) return null;
      const [checkins, link] = await Promise.all([
        getDocs(query(collection(db, 'checkins'), where('clientUserId', '==', user.uid))).then((s) => s.docs.map(withId)),
        getDoc(doc(db, 'checkinLinks', client.token)).then((s) => (s.exists() ? s.data() : null)),
      ]);
      return { ...summarizeClient(client, checkins), coachName: await coachNameOf(client.coachId, link) };
    }),

    claimInvite: guarded(async (token) => {
      const user = await requireUser(ROLES.client);
      if (await myClientDoc(user)) throw new AppError('invite/has-coach', 'Акаунтът ви вече е свързан с треньор.');
      const linkSnap = await getDoc(doc(db, 'checkinLinks', token));
      if (!linkSnap.exists()) throw new AppError('invite/invalid', 'Поканата не е валидна. Помолете треньора си за нов линк.');
      const link = linkSnap.data();
      if (link.clientUserId && link.clientUserId !== user.uid) throw new AppError('invite/claimed', 'Тази покана вече е използвана от друг акаунт.');

      // Rules allow this only while unclaimed and only with the matching token (claimToken).
      const batch = writeBatch(db);
      batch.update(doc(db, 'clients', link.clientId), { userId: user.uid, claimToken: token });
      batch.update(doc(db, 'checkinLinks', token), { clientUserId: user.uid });
      await batch.commit();

      const client = withId(await getDoc(doc(db, 'clients', link.clientId)));
      return { ...summarizeClient(client, []), coachName: link.coachName ?? '' };
    }),

    listMyCheckins: guarded(async () => {
      const user = await requireUser(ROLES.client);
      const snap = await getDocs(query(collection(db, 'checkins'), where('clientUserId', '==', user.uid)));
      const resolved = await Promise.all(snap.docs.map(withId).map(resolvePhotos));
      return resolved.sort((a, b) => b.createdAt - a.createdAt);
    }),

    /* ---------- Public (by token) ---------- */

    getCheckinContext: guarded(async (token) => {
      if (!token) return null;
      const snap = await getDoc(doc(db, 'checkinLinks', token));
      if (!snap.exists()) return null;
      const link = snap.data();
      return { ...link, claimed: Boolean(link.clientUserId) };
    }),

    submitCheckin: guarded(async (token, payload) => {
      const data = validateCheckin(payload);
      const linkSnap = await getDoc(doc(db, 'checkinLinks', token));
      if (!linkSnap.exists()) throw new AppError('link/invalid', 'Линкът за check-in е невалиден или изтрит.');
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

      const checkin = {
        token, clientId: link.clientId, coachId: link.coachId, ...data, photos, createdAt: Date.now(),
        ...(link.clientUserId ? { clientUserId: link.clientUserId } : {}),
      };
      await setDoc(checkinRef, checkin);
      return { id: checkinRef.id, ...checkin };
    }),
  };
}
