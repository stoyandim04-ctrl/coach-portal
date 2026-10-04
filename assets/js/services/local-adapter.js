/**
 * localStorage adapter — a zero-setup backend for the MVP / demo.
 *
 * Data shape mirrors the Firestore collections used by firebase-adapter.js:
 *   users/{id}        { name, email, role: 'coach' | 'client', ... }
 *   clients/{id}      { coachId, name, email, goal, token, program, userId? }
 *   checkins/{id}     { token, clientId, coachId, weight, scores…, photos, coachNote }
 *   links/{token}     { clientId, coachId }
 *   notes/{clientId}  { text, updatedAt }                 (coach-only)
 *
 * Data from the previous version (FitCheck, `fitcheck:v1:*`) is migrated on first load.
 * Limitation: data lives in ONE browser — use the Firebase backend for real usage.
 */
import { AppError, uid, sleep } from '../lib/utils.js';
import {
  ROLES, PHOTO_SLOTS, validateRegistration, validateClient, validateCheckin, summarizeClient, normalizeEmail, normalizeProgram,
} from '../lib/model.js';

const DB_KEY = 'coachportal:v2:db';
const SESSION_KEY = 'coachportal:v2:session';
const LEGACY_DB_KEY = 'fitcheck:v1:db';
const LEGACY_SESSION_KEY = 'fitcheck:v1:session';

const emptyDb = () => ({ users: {}, clients: {}, checkins: {}, links: {}, notes: {} });

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (err) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      throw new AppError('storage/quota', 'Паметта на браузъра е пълна. Изтрийте стари клиенти или свържете Firebase.');
    }
    throw err;
  }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** One-time migration: FitCheck v1 (coaches only) → Coach Portal v2 (users with roles). */
function migrateLegacy() {
  const raw = storageGet(LEGACY_DB_KEY);
  if (!raw || storageGet(DB_KEY)) return;
  try {
    const old = JSON.parse(raw);
    const db = emptyDb();
    for (const c of Object.values(old.coaches ?? {})) db.users[c.id] = { ...c, role: ROLES.coach };
    db.clients = old.clients ?? {};
    db.checkins = old.checkins ?? {};
    db.links = old.links ?? {};
    storageSet(DB_KEY, JSON.stringify(db));
    const session = storageGet(LEGACY_SESSION_KEY);
    if (session) storageSet(SESSION_KEY, session);
    storageRemove(LEGACY_DB_KEY);
    storageRemove(LEGACY_SESSION_KEY);
  } catch (err) {
    console.error('[Coach Portal] migration failed', err);
  }
}

function readDb() {
  const raw = storageGet(DB_KEY);
  if (!raw) return emptyDb();
  try { return { ...emptyDb(), ...JSON.parse(raw) }; } catch { return emptyDb(); }
}

function writeDb(db) {
  storageSet(DB_KEY, JSON.stringify(db));
}

/** SHA-256 when available (secure contexts); FNV-1a fallback for plain-http LAN testing. */
async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv:${h.toString(16)}`;
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });

export function createAdapter() {
  // Simulated network latency keeps loading states honest during the prototype phase.
  const latency = () => sleep(80 + Math.random() * 120);
  const sessionUserId = () => storageGet(SESSION_KEY);

  function requireUser(db, role) {
    const user = db.users[sessionUserId()];
    if (!user) throw new AppError('auth/required', 'Сесията е изтекла. Влезте отново.');
    if (role && user.role !== role) throw new AppError('auth/role', 'Нямате достъп до тази страница.');
    return user;
  }

  function ownedClient(db, coach, clientId) {
    const client = db.clients[clientId];
    if (!client || client.coachId !== coach.id) throw new AppError('not-found', 'Клиентът не е намерен.');
    return client;
  }

  const checkinsOf = (db, clientId) => Object.values(db.checkins).filter((c) => c.clientId === clientId);
  const coachName = (db, coachId) => db.users[coachId]?.name ?? '';

  async function createUser({ name, email, password, role }) {
    const db = readDb();
    if (Object.values(db.users).some((u) => u.email === email)) {
      throw new AppError('auth/email-in-use', 'Вече има акаунт с този имейл. Опитайте вход.');
    }
    const salt = uid(16);
    const user = { id: uid(), name, email, role, salt, passwordHash: await hashPassword(password, salt), createdAt: Date.now() };
    db.users[user.id] = user;
    writeDb(db);
    return user;
  }

  function linkClient(db, user, token) {
    const link = db.links[token];
    const client = link && db.clients[link.clientId];
    if (!client) throw new AppError('invite/invalid', 'Поканата не е валидна. Помолете треньора си за нов линк.');
    if (client.userId && client.userId !== user.id) throw new AppError('invite/claimed', 'Тази покана вече е използвана от друг акаунт.');
    if (Object.values(db.clients).some((c) => c.userId === user.id && c.id !== client.id)) {
      throw new AppError('invite/has-coach', 'Акаунтът ви вече е свързан с треньор.');
    }
    client.userId = user.id;
    return client;
  }

  return {
    kind: 'local',
    photoOptions: { maxSize: 720, quality: 0.62 },

    async init() {
      migrateLegacy();
    },

    /* ---------- Auth ---------- */

    async register(input) {
      const data = validateRegistration(input);
      await latency();
      const user = await createUser(data);
      storageSet(SESSION_KEY, user.id);
      return publicUser(user);
    },

    async login({ email, password }) {
      await latency();
      const db = readDb();
      const user = Object.values(db.users).find((u) => u.email === normalizeEmail(email));
      if (!user || (await hashPassword(String(password ?? ''), user.salt)) !== user.passwordHash) {
        throw new AppError('auth/invalid-credential', 'Грешен имейл или парола.');
      }
      storageSet(SESSION_KEY, user.id);
      return publicUser(user);
    },

    async logout() {
      storageRemove(SESSION_KEY);
    },

    async getCurrentUser() {
      const user = readDb().users[sessionUserId()];
      return user ? publicUser(user) : null;
    },

    /* ---------- Coach ---------- */

    async listClients() {
      await latency();
      const db = readDb();
      const coach = requireUser(db, ROLES.coach);
      return Object.values(db.clients)
        .filter((c) => c.coachId === coach.id)
        .map((c) => ({ ...summarizeClient(c, checkinsOf(db, c.id)), claimed: Boolean(c.userId) }));
    },

    async createClient(input) {
      const data = validateClient(input);
      await latency();
      const db = readDb();
      const coach = requireUser(db, ROLES.coach);
      const client = { id: uid(), coachId: coach.id, ...data, token: uid(24), program: normalizeProgram(null), createdAt: Date.now() };
      db.clients[client.id] = client;
      db.links[client.token] = { clientId: client.id, coachId: coach.id };
      writeDb(db);
      return { ...summarizeClient(client, []), claimed: false };
    },

    async getClient(clientId) {
      const db = readDb();
      const client = ownedClient(db, requireUser(db, ROLES.coach), clientId);
      return { ...summarizeClient(client, checkinsOf(db, clientId)), claimed: Boolean(client.userId) };
    },

    async deleteClient(clientId) {
      await latency();
      const db = readDb();
      const client = ownedClient(db, requireUser(db, ROLES.coach), clientId);
      for (const c of checkinsOf(db, clientId)) delete db.checkins[c.id];
      delete db.links[client.token];
      delete db.notes[clientId];
      delete db.clients[clientId];
      writeDb(db);
    },

    async listCheckins(clientId) {
      await latency();
      const db = readDb();
      ownedClient(db, requireUser(db, ROLES.coach), clientId);
      return checkinsOf(db, clientId).sort((a, b) => b.createdAt - a.createdAt);
    },

    /** All of the coach's check-ins, newest first (for the messages inbox). */
    async listCoachCheckins() {
      await latency();
      const db = readDb();
      const coach = requireUser(db, ROLES.coach);
      return Object.values(db.checkins).filter((c) => c.coachId === coach.id).sort((a, b) => b.createdAt - a.createdAt);
    },

    async updateCoachNote(checkinId, note) {
      await latency();
      const db = readDb();
      const coach = requireUser(db, ROLES.coach);
      const checkin = db.checkins[checkinId];
      if (!checkin || checkin.coachId !== coach.id) throw new AppError('not-found', 'Check-in-ът не е намерен.');
      checkin.coachNote = String(note ?? '').trim().slice(0, 2000);
      checkin.coachNoteAt = Date.now();
      writeDb(db);
      return { id: checkinId, coachNote: checkin.coachNote, coachNoteAt: checkin.coachNoteAt };
    },

    async updateProgram(clientId, program) {
      await latency();
      const db = readDb();
      const client = ownedClient(db, requireUser(db, ROLES.coach), clientId);
      client.program = normalizeProgram(program);
      writeDb(db);
      return client.program;
    },

    async getClientNotes(clientId) {
      const db = readDb();
      ownedClient(db, requireUser(db, ROLES.coach), clientId);
      return db.notes[clientId] ?? { text: '', updatedAt: null };
    },

    async saveClientNotes(clientId, text) {
      await latency();
      const db = readDb();
      ownedClient(db, requireUser(db, ROLES.coach), clientId);
      db.notes[clientId] = { text: String(text ?? '').slice(0, 10000), updatedAt: Date.now() };
      writeDb(db);
      return db.notes[clientId];
    },

    /* ---------- Client ---------- */

    /** The signed-in client's record with their coach, or null if not linked yet. */
    async getMyClient() {
      await latency();
      const db = readDb();
      const user = requireUser(db, ROLES.client);
      const client = Object.values(db.clients).find((c) => c.userId === user.id);
      if (!client) return null;
      return { ...summarizeClient(client, checkinsOf(db, client.id)), coachName: coachName(db, client.coachId) };
    },

    async claimInvite(token) {
      await latency();
      const db = readDb();
      const user = requireUser(db, ROLES.client);
      const client = linkClient(db, user, token);
      writeDb(db);
      return { ...summarizeClient(client, checkinsOf(db, client.id)), coachName: coachName(db, client.coachId) };
    },

    async listMyCheckins() {
      await latency();
      const db = readDb();
      const user = requireUser(db, ROLES.client);
      const client = Object.values(db.clients).find((c) => c.userId === user.id);
      if (!client) return [];
      return checkinsOf(db, client.id).sort((a, b) => b.createdAt - a.createdAt);
    },

    /* ---------- Public (by token) ---------- */

    async getCheckinContext(token) {
      await latency();
      const db = readDb();
      const link = db.links[token];
      const client = link && db.clients[link.clientId];
      if (!client) return null;
      return { clientId: client.id, coachId: client.coachId, clientName: client.name, coachName: coachName(db, client.coachId), claimed: Boolean(client.userId) };
    },

    async submitCheckin(token, payload) {
      const data = validateCheckin(payload);
      await latency();
      const db = readDb();
      const link = db.links[token];
      if (!link || !db.clients[link.clientId]) throw new AppError('link/invalid', 'Линкът за check-in е невалиден или изтрит.');

      const photos = {};
      for (const { key } of PHOTO_SLOTS) {
        if (payload.photos?.[key]?.dataUrl) photos[key] = payload.photos[key].dataUrl;
      }

      const checkin = { id: uid(), token, clientId: link.clientId, coachId: link.coachId, ...data, photos, coachNote: '', createdAt: Date.now() };
      db.checkins[checkin.id] = checkin;
      writeDb(db);
      return checkin;
    },

    /* ---------- Demo ---------- */

    /** Creates (or reuses) the demo coach + linked demo client and signs in as `role`. */
    async seedDemo(role = ROLES.coach) {
      const { buildDemoData, DEMO_COACH, DEMO_CLIENT } = await import('./demo-data.js');
      let db = readDb();
      let coach = Object.values(db.users).find((u) => u.email === DEMO_COACH.email);
      if (!coach) {
        coach = await createUser({ ...DEMO_COACH, role: ROLES.coach });
        const client = await createUser({ ...DEMO_CLIENT, role: ROLES.client });
        db = readDb();
        const data = buildDemoData(coach.id, client.id);
        Object.assign(db.clients, data.clients);
        Object.assign(db.checkins, data.checkins);
        Object.assign(db.links, data.links);
        Object.assign(db.notes, data.notes);
        writeDb(db);
      }
      let target = coach;
      if (role === ROLES.client) {
        target = Object.values(readDb().users).find((u) => u.email === DEMO_CLIENT.email);
        if (!target) {
          // Demo created by an older version: add the client account and link it to the first demo client.
          target = await createUser({ ...DEMO_CLIENT, role: ROLES.client });
          db = readDb();
          const first = Object.values(db.clients).filter((c) => c.coachId === coach.id).sort((a, b) => a.createdAt - b.createdAt)[0];
          if (first) {
            first.userId = target.id;
            writeDb(db);
          }
        }
      }
      storageSet(SESSION_KEY, target.id);
      return publicUser(target);
    },
  };
}
