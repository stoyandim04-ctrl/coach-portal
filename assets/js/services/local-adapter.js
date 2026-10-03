/**
 * localStorage adapter — a zero-setup backend for the MVP / demo.
 *
 * Data shape mirrors the Firestore collections used by firebase-adapter.js:
 *   coaches/{id}, clients/{id}, checkins/{id}, links/{token}
 *
 * Limitation: data lives in ONE browser. A check-in link opened on another device
 * will not find the client — switch to the Firebase backend for real usage.
 */
import { AppError, uid, sleep } from '../lib/utils.js';
import { validateRegistration, validateClient, validateCheckin, summarizeClient, normalizeEmail, PHOTO_SLOTS } from '../lib/model.js';

const DB_KEY = 'fitcheck:v1:db';
const SESSION_KEY = 'fitcheck:v1:session';

const emptyDb = () => ({ coaches: {}, clients: {}, checkins: {}, links: {} });

function readDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb();
  } catch {
    return emptyDb();
  }
}

function writeDb(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      throw new AppError('storage/quota', 'Паметта на браузъра е пълна (демо режим). Изтрийте стари клиенти или свържете Firebase.');
    }
    throw err;
  }
}

/** SHA-256 when available (secure contexts); FNV-1a fallback for plain-http LAN testing. */
async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (crypto?.subtle) {
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

const publicCoach = (c) => ({ id: c.id, name: c.name, email: c.email, createdAt: c.createdAt });

export function createAdapter() {
  // Simulated network latency keeps loading states honest during the prototype phase.
  const latency = () => sleep(120 + Math.random() * 180);

  const sessionCoachId = () => localStorage.getItem(SESSION_KEY);

  function requireCoach(db) {
    const coach = db.coaches[sessionCoachId()];
    if (!coach) throw new AppError('auth/required', 'Сесията е изтекла. Моля, влезте отново.');
    return coach;
  }

  function ownedClient(db, coach, clientId) {
    const client = db.clients[clientId];
    if (!client || client.coachId !== coach.id) throw new AppError('not-found', 'Клиентът не е намерен.');
    return client;
  }

  const checkinsOf = (db, clientId) => Object.values(db.checkins).filter((c) => c.clientId === clientId);

  async function createCoach({ name, email, password }) {
    const db = readDb();
    if (Object.values(db.coaches).some((c) => c.email === email)) {
      throw new AppError('auth/email-in-use', 'Вече има акаунт с този имейл. Опитайте вход.');
    }
    const salt = uid(16);
    const coach = { id: uid(), name, email, salt, passwordHash: await hashPassword(password, salt), createdAt: Date.now() };
    db.coaches[coach.id] = coach;
    writeDb(db);
    return coach;
  }

  return {
    kind: 'local',
    photoOptions: { maxSize: 720, quality: 0.62 },

    async init() {},

    async register(input) {
      const data = validateRegistration(input);
      await latency();
      const coach = await createCoach(data);
      localStorage.setItem(SESSION_KEY, coach.id);
      return publicCoach(coach);
    },

    async login({ email, password }) {
      await latency();
      const db = readDb();
      const coach = Object.values(db.coaches).find((c) => c.email === normalizeEmail(email));
      if (!coach || (await hashPassword(String(password ?? ''), coach.salt)) !== coach.passwordHash) {
        throw new AppError('auth/invalid-credential', 'Грешен имейл или парола.');
      }
      localStorage.setItem(SESSION_KEY, coach.id);
      return publicCoach(coach);
    },

    async logout() {
      localStorage.removeItem(SESSION_KEY);
    },

    async getCurrentCoach() {
      const coach = readDb().coaches[sessionCoachId()];
      return coach ? publicCoach(coach) : null;
    },

    async listClients() {
      await latency();
      const db = readDb();
      const coach = requireCoach(db);
      return Object.values(db.clients)
        .filter((c) => c.coachId === coach.id)
        .map((c) => summarizeClient(c, checkinsOf(db, c.id)));
    },

    async createClient(input) {
      const data = validateClient(input);
      await latency();
      const db = readDb();
      const coach = requireCoach(db);
      const client = { id: uid(), coachId: coach.id, ...data, token: uid(24), createdAt: Date.now() };
      db.clients[client.id] = client;
      db.links[client.token] = { clientId: client.id, coachId: coach.id };
      writeDb(db);
      return summarizeClient(client, []);
    },

    async getClient(clientId) {
      const db = readDb();
      const client = ownedClient(db, requireCoach(db), clientId);
      return summarizeClient(client, checkinsOf(db, clientId));
    },

    async deleteClient(clientId) {
      await latency();
      const db = readDb();
      const client = ownedClient(db, requireCoach(db), clientId);
      for (const c of checkinsOf(db, clientId)) delete db.checkins[c.id];
      delete db.links[client.token];
      delete db.clients[clientId];
      writeDb(db);
    },

    async listCheckins(clientId) {
      await latency();
      const db = readDb();
      ownedClient(db, requireCoach(db), clientId);
      return checkinsOf(db, clientId).sort((a, b) => b.createdAt - a.createdAt);
    },

    async updateCoachNote(checkinId, note) {
      await latency();
      const db = readDb();
      const coach = requireCoach(db);
      const checkin = db.checkins[checkinId];
      if (!checkin || checkin.coachId !== coach.id) throw new AppError('not-found', 'Отчетът не е намерен.');
      checkin.coachNote = String(note ?? '').trim().slice(0, 2000);
      checkin.coachNoteAt = Date.now();
      writeDb(db);
      return checkin;
    },

    async getCheckinContext(token) {
      await latency();
      const db = readDb();
      const link = db.links[token];
      const client = link && db.clients[link.clientId];
      if (!client) return null;
      return { clientId: client.id, coachId: client.coachId, clientName: client.name, coachName: db.coaches[client.coachId]?.name ?? '' };
    },

    async submitCheckin(token, payload) {
      const data = validateCheckin(payload);
      await latency();
      const db = readDb();
      const link = db.links[token];
      if (!link || !db.clients[link.clientId]) throw new AppError('link/invalid', 'Линкът за чек-ин е невалиден или изтрит.');

      const photos = {};
      for (const { key } of PHOTO_SLOTS) {
        if (payload.photos?.[key]?.dataUrl) photos[key] = payload.photos[key].dataUrl;
      }

      const checkin = { id: uid(), token, clientId: link.clientId, coachId: link.coachId, ...data, photos, coachNote: '', createdAt: Date.now() };
      db.checkins[checkin.id] = checkin;
      writeDb(db);
      return checkin;
    },

    /** Creates (or reuses) a demo coach with realistic sample clients and logs in. */
    async seedDemo() {
      const { buildDemoData, DEMO_COACH } = await import('./demo-data.js');
      let db = readDb();
      let coach = Object.values(db.coaches).find((c) => c.email === DEMO_COACH.email);
      if (!coach) {
        coach = await createCoach(DEMO_COACH);
        db = readDb();
        const { clients, checkins, links } = buildDemoData(coach.id);
        Object.assign(db.clients, clients);
        Object.assign(db.checkins, checkins);
        Object.assign(db.links, links);
        writeDb(db);
      }
      localStorage.setItem(SESSION_KEY, coach.id);
      return publicCoach(coach);
    },
  };
}
