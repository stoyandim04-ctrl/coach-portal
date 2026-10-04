/**
 * Generic, framework-free helpers shared by every page.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Error with a stable code and a user-facing (Bulgarian) message. */
export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/** Returns a user-facing message for any thrown value. */
export function errorMessage(err) {
  if (err instanceof AppError) return err.message;
  console.error(err);
  return 'Възникна неочаквана грешка. Опитайте отново.';
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Cryptographically random, URL-safe id. Works in insecure contexts too (LAN testing). */
export function uid(length = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/* ---------- Numbers & dates ---------- */

const DAY = 24 * 60 * 60 * 1000;

export function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('bg-BG', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
}

/** Integer with a space as thousands separator (bg-BG doesn't group 4-digit numbers). */
export function formatInt(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

export function formatDelta(value, unit = 'кг') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? '+' : '−'}${formatNumber(Math.abs(rounded))} ${unit}`;
}

export function formatDate(ts, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('bg-BG', opts).format(new Date(ts));
}

export function formatDateTime(ts) {
  return new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export function daysSince(ts, now = Date.now()) {
  if (!ts) return null;
  const startOf = (t) => new Date(new Date(t).toDateString()).getTime();
  return Math.round((startOf(now) - startOf(ts)) / DAY);
}

export function relativeDays(ts, now = Date.now()) {
  const d = daysSince(ts, now);
  if (d === null) return 'никога';
  if (d <= 0) return 'днес';
  if (d === 1) return 'вчера';
  if (d < 7) return `преди ${d} дни`;
  const weeks = Math.floor(d / 7);
  if (d < 30) return weeks === 1 ? 'преди 1 седмица' : `преди ${weeks} седмици`;
  const months = Math.floor(d / 30);
  return months === 1 ? 'преди 1 месец' : `преди ${months} месеца`;
}

/** ISO-8601 week number + week-year. */
export function isoWeek(ts) {
  const date = new Date(ts);
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d - yearStart) / DAY + 1) / 7), year: d.getUTCFullYear() };
}

/* ---------- Images ---------- */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new AppError('image/invalid', 'Файлът не е валидно изображение.')); };
    img.src = url;
  });
}

/**
 * Downscales and re-encodes a photo to JPEG so it is cheap to store/upload.
 * Returns both a data URL (for previews / localStorage) and a Blob (for cloud upload).
 */
export async function compressImage(file, { maxSize = 1080, quality = 0.75 } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    throw new AppError('image/invalid', 'Моля, изберете снимка (JPG, PNG, HEIC).');
  }
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return { dataUrl, blob, width, height };
}

/* ---------- Misc ---------- */

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts (e.g. testing over LAN IP)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
