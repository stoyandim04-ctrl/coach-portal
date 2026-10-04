/**
 * Domain model: constants, validation and derived data.
 * Pure functions only — shared by both storage adapters and the UI.
 */
import { AppError, daysSince } from './utils.js';

export const APP_NAME = 'Coach Portal';

/* ---------- Roles ---------- */

export const ROLES = { coach: 'coach', client: 'client' };
export const HOME_BY_ROLE = { coach: 'coach.html', client: 'client.html' };

/* ---------- Check-in fields ---------- */

export const PHOTO_SLOTS = [
  { key: 'front', label: 'Отпред' },
  { key: 'side', label: 'Отстрани' },
  { key: 'back', label: 'Отзад' },
];

export const MEASUREMENTS = [
  { key: 'waist', label: 'Талия', hint: 'на нивото на пъпа' },
  { key: 'chest', label: 'Гърди', hint: 'най-широката част' },
  { key: 'hips', label: 'Ханш', hint: 'през седалището' },
  { key: 'arm', label: 'Ръка', hint: 'бицепс, отпуснат' },
  { key: 'thigh', label: 'Бедро', hint: 'най-широката част' },
];

/**
 * 1–10 scores. `required` ones exist on every check-in (including older data);
 * the rest were added later and may be missing on old check-ins.
 */
export const SCORES = [
  { key: 'sleep', label: 'Сън', low: 'Лош', high: 'Отличен', required: true, step: 1 },
  { key: 'energy', label: 'Енергия', low: 'Ниска', high: 'Висока', required: true, step: 1 },
  { key: 'stress', label: 'Стрес', low: 'Нисък', high: 'Висок', step: 1 },
  { key: 'hunger', label: 'Глад', low: 'Слаб', high: 'Силен', step: 2 },
  { key: 'adherence', label: 'Придържане към хранителния план', short: 'Хранене', low: 'Слабо', high: 'Пълно', step: 2 },
  { key: 'performance', label: 'Представяне в тренировките', short: 'Тренировки', low: 'Слабо', high: 'Отлично', step: 2 },
];

/* ---------- Check-in freshness ---------- */

export const STATUS = {
  ok: { key: 'ok', label: 'Навреме', dot: 'bg-success', text: 'text-success' },
  due: { key: 'due', label: 'Закъснява', dot: 'bg-warning', text: 'text-warning' },
  late: { key: 'late', label: 'Пропуснат check-in', dot: 'bg-danger', text: 'text-danger' },
  none: { key: 'none', label: 'Без check-in', dot: 'bg-subtle', text: 'text-subtle' },
};

export function checkinStatus(lastCheckinAt, now = Date.now()) {
  const days = daysSince(lastCheckinAt, now);
  if (days === null) return STATUS.none;
  if (days <= 7) return STATUS.ok;
  if (days <= 14) return STATUS.due;
  return STATUS.late;
}

/* ---------- Program ---------- */

export const WEEKDAYS = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
export const WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function emptyProgram() {
  return { workouts: ['', '', '', '', '', '', ''], nutrition: '', steps: null, checkinDay: 0 };
}

export function normalizeProgram(program) {
  const base = emptyProgram();
  if (!program) return base;
  const workouts = Array.isArray(program.workouts) ? program.workouts : [];
  return {
    workouts: base.workouts.map((_, i) => String(workouts[i] ?? '').trim().slice(0, 40)),
    nutrition: String(program.nutrition ?? '').trim().slice(0, 2000),
    steps: Number.isFinite(Number(program.steps)) && Number(program.steps) > 0 ? Math.min(100000, Math.round(Number(program.steps))) : null,
    checkinDay: Number.isInteger(Number(program.checkinDay)) ? Math.min(6, Math.max(0, Number(program.checkinDay))) : 0,
  };
}

export function hasProgram(program) {
  const p = normalizeProgram(program);
  return p.workouts.some(Boolean) || Boolean(p.nutrition) || p.steps !== null;
}

/** Workout name for a date, or '' for a rest day. */
export function workoutFor(program, date = new Date()) {
  return normalizeProgram(program).workouts[date.getDay()];
}

/**
 * Next scheduled check-in: the next occurrence of `checkinDay`, today included,
 * unless the client already checked in today.
 */
export function nextCheckin(program, lastCheckinAt, now = new Date()) {
  const { checkinDay } = normalizeProgram(program);
  const checkedInToday = lastCheckinAt && daysSince(lastCheckinAt, now.getTime()) === 0;
  let days = (checkinDay - now.getDay() + 7) % 7;
  if (days === 0 && checkedInToday) days = 7;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return { date, days, weekday: WEEKDAYS[checkinDay] };
}

export function inDays(days) {
  if (days === 0) return 'Днес';
  if (days === 1) return 'Утре';
  return `След ${days} дни`;
}

/* ---------- Validation ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function validateRegistration({ name, email, password, role }) {
  const clean = { name: String(name ?? '').trim(), email: normalizeEmail(email), password: String(password ?? ''), role };
  if (!Object.values(ROLES).includes(role)) throw new AppError('validation/role', 'Изберете как ще използвате Coach Portal.');
  if (clean.name.length < 2) throw new AppError('validation/name', 'Въведете името си.');
  if (!EMAIL_RE.test(clean.email)) throw new AppError('validation/email', 'Въведете валиден имейл.');
  if (clean.password.length < 6) throw new AppError('validation/password', 'Паролата трябва да е поне 6 символа.');
  return clean;
}

export function validateClient({ name, email, goal }) {
  const clean = {
    name: String(name ?? '').trim(),
    email: normalizeEmail(email),
    goal: String(goal ?? '').trim().slice(0, 140),
  };
  if (clean.name.length < 2) throw new AppError('validation/name', 'Въведете име на клиента.');
  if (clean.email && !EMAIL_RE.test(clean.email)) throw new AppError('validation/email', 'Имейлът не е валиден.');
  return clean;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Validates a check-in. Returns a clean object without photos. */
export function validateCheckin(payload) {
  const clientName = String(payload.clientName ?? '').trim();
  if (clientName.length < 2) throw new AppError('validation/name', 'Въведете името си.');

  const weight = toNumber(payload.weight);
  if (weight === null || Number.isNaN(weight) || weight < 25 || weight > 350) {
    throw new AppError('validation/weight', 'Въведете тегло в килограми, напр. 72,5.');
  }

  const scores = {};
  for (const s of SCORES) {
    const raw = payload[s.key];
    if ((raw === null || raw === undefined || raw === '') && !s.required) continue;
    const n = Math.round(Number(raw));
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new AppError('validation/score', `Оценката „${s.short ?? s.label}“ трябва да е от 1 до 10.`);
    scores[s.key] = n;
  }

  const measurements = {};
  for (const { key, label } of MEASUREMENTS) {
    const n = toNumber(payload.measurements?.[key]);
    if (n === null) continue;
    if (Number.isNaN(n) || n < 10 || n > 250) throw new AppError('validation/measurement', `„${label}“ трябва да е в сантиметри (10–250).`);
    measurements[key] = Math.round(n * 10) / 10;
  }

  return {
    clientName: clientName.slice(0, 80),
    weight: Math.round(weight * 10) / 10,
    ...scores,
    measurements,
    comment: String(payload.comment ?? '').trim().slice(0, 2000),
  };
}

/** Accepts an invite link (any URL with ?invite= or ?t=) or a bare token. */
export function parseInvite(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.searchParams.get('invite') || url.searchParams.get('t') || null;
  } catch {
    return /^[A-Za-z0-9]{12,64}$/.test(value) ? value : null;
  }
}

/* ---------- Derived data ---------- */

/** Adds list aggregates to a client record. `checkins` may be in any order. */
export function summarizeClient(client, checkins) {
  const sorted = [...checkins].sort((a, b) => a.createdAt - b.createdAt);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    ...client,
    program: normalizeProgram(client.program),
    checkinCount: sorted.length,
    lastCheckinAt: last?.createdAt ?? null,
    lastCheckinId: last?.id ?? null,
    firstWeight: first?.weight ?? null,
    lastWeight: last?.weight ?? null,
    awaitingReply: Boolean(last && !String(last.coachNote ?? '').trim()),
  };
}

/** What needs the coach's attention, in priority order. Only non-empty items. */
export function attentionItems(clients) {
  const statuses = clients.map((c) => ({ c, s: checkinStatus(c.lastCheckinAt).key }));
  const items = [
    { key: 'reply', count: clients.filter((c) => c.awaitingReply).length, one: 'check-in чака отговор', many: 'check-in-а чакат отговор', tone: 'text-fg', dot: 'bg-accent' },
    { key: 'late', count: statuses.filter((x) => x.s === 'late' || x.s === 'due').length, one: 'клиент закъснява с check-in', many: 'клиента закъсняват с check-in', tone: 'text-fg', dot: 'bg-warning' },
    { key: 'none', count: statuses.filter((x) => x.s === 'none').length, one: 'клиент още няма check-in', many: 'клиента още нямат check-in', tone: 'text-fg', dot: 'bg-subtle' },
  ];
  return items.filter((i) => i.count > 0).map((i) => ({ ...i, label: `${i.count} ${i.count === 1 ? i.one : i.many}` }));
}

/** Sort: needs a reply → late → no check-in → most recent check-in first. */
export function byAttention(a, b) {
  const rank = (c) => {
    if (c.awaitingReply) return 0;
    const s = checkinStatus(c.lastCheckinAt).key;
    return s === 'late' ? 1 : s === 'due' ? 2 : s === 'none' ? 3 : 4;
  };
  return rank(a) - rank(b) || (b.lastCheckinAt ?? 0) - (a.lastCheckinAt ?? 0) || b.createdAt - a.createdAt;
}

export function average(values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
