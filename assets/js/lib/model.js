/**
 * Domain model: constants, validation and derived data.
 * Pure functions only — shared by both storage adapters and the UI.
 */
import { AppError, daysSince } from './utils.js';

export const PHOTO_SLOTS = [
  { key: 'front', label: 'Отпред', hint: 'Front' },
  { key: 'side', label: 'Отстрани', hint: 'Side' },
  { key: 'back', label: 'Отзад', hint: 'Back' },
];

export const MEASUREMENTS = [
  { key: 'waist', label: 'Талия' },
  { key: 'chest', label: 'Гърди' },
  { key: 'hips', label: 'Ханш' },
  { key: 'arm', label: 'Ръка' },
  { key: 'thigh', label: 'Бедро' },
];

/** Check-in freshness indicator shown on the coach dashboard. */
export const STATUS = {
  ok: { key: 'ok', label: 'Навреме', dot: 'bg-emerald-400', text: 'text-emerald-300', badge: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20' },
  due: { key: 'due', label: 'Очаква се', dot: 'bg-amber-400', text: 'text-amber-300', badge: 'bg-amber-400/10 text-amber-300 ring-amber-400/20' },
  late: { key: 'late', label: 'Просрочен', dot: 'bg-rose-500', text: 'text-rose-300', badge: 'bg-rose-500/10 text-rose-300 ring-rose-500/20' },
  none: { key: 'none', label: 'Без чек-ин', dot: 'bg-zinc-500', text: 'text-zinc-400', badge: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20' },
};

export function checkinStatus(lastCheckinAt, now = Date.now()) {
  const days = daysSince(lastCheckinAt, now);
  if (days === null) return STATUS.none;
  if (days <= 7) return STATUS.ok;
  if (days <= 14) return STATUS.due;
  return STATUS.late;
}

/* ---------- Validation ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function validateRegistration({ name, email, password }) {
  const clean = { name: String(name ?? '').trim(), email: normalizeEmail(email), password: String(password ?? '') };
  if (clean.name.length < 2) throw new AppError('validation/name', 'Въведете името си (поне 2 символа).');
  if (!EMAIL_RE.test(clean.email)) throw new AppError('validation/email', 'Въведете валиден имейл адрес.');
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
  if (clean.email && !EMAIL_RE.test(clean.email)) throw new AppError('validation/email', 'Имейлът на клиента не е валиден.');
  return clean;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** Validates the client check-in form. Returns a clean object without photos. */
export function validateCheckin(payload) {
  const clientName = String(payload.clientName ?? '').trim();
  if (clientName.length < 2) throw new AppError('validation/name', 'Моля, въведете името си.');

  const weight = toNumber(payload.weight);
  if (weight === null || Number.isNaN(weight) || weight < 25 || weight > 350) {
    throw new AppError('validation/weight', 'Въведете валидно тегло в килограми (напр. 72.5).');
  }

  const score = (v, label) => {
    const n = Math.round(Number(v));
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new AppError('validation/score', `Оценката за ${label} трябва да е от 1 до 10.`);
    return n;
  };

  const measurements = {};
  for (const { key, label } of MEASUREMENTS) {
    const n = toNumber(payload.measurements?.[key]);
    if (n === null) continue;
    if (Number.isNaN(n) || n < 10 || n > 250) throw new AppError('validation/measurement', `Мярката „${label}“ трябва да е в сантиметри (10–250).`);
    measurements[key] = Math.round(n * 10) / 10;
  }

  return {
    clientName: clientName.slice(0, 80),
    weight: Math.round(weight * 10) / 10,
    sleep: score(payload.sleep, 'съня'),
    energy: score(payload.energy, 'енергията'),
    measurements,
    comment: String(payload.comment ?? '').trim().slice(0, 2000),
  };
}

/* ---------- Derived data ---------- */

/** Adds dashboard aggregates to a client record. `checkins` may be in any order. */
export function summarizeClient(client, checkins) {
  const sorted = [...checkins].sort((a, b) => a.createdAt - b.createdAt);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    ...client,
    checkinCount: sorted.length,
    lastCheckinAt: last?.createdAt ?? null,
    firstWeight: first?.weight ?? null,
    lastWeight: last?.weight ?? null,
  };
}

export function average(values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
