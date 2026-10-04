/**
 * Role-aware routing helpers shared by every signed-in page.
 */
import { HOME_BY_ROLE } from './model.js';

/**
 * Ensures the signed-in user has `role`. Otherwise redirects (to login, or to the
 * user's own home) and resolves to null so the caller can stop.
 */
export async function requireRole(backend, role) {
  const user = await backend.getCurrentUser();
  if (!user) {
    window.location.replace('index.html#login');
    return null;
  }
  if (user.role !== role) {
    window.location.replace(HOME_BY_ROLE[user.role] ?? 'index.html');
    return null;
  }
  return user;
}

export function homeFor(user) {
  return HOME_BY_ROLE[user?.role] ?? 'index.html';
}

export function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] ?? '';
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return 'Добро утро';
  if (h < 18) return 'Добър ден';
  return 'Добър вечер';
}

export function todayLabel(date = new Date()) {
  const s = new Intl.DateTimeFormat('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
