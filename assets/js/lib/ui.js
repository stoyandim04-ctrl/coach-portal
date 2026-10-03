/**
 * Small UI kit: icons, toasts, modals, button loading state, photo lightbox.
 */
import { escapeHtml } from './utils.js';

/* ---------- Icons (Lucide-style, stroke based) ---------- */

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1ZM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  dumbbell: '<path d="M14.4 14.4 9.6 9.6M18.66 21.51a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.37-6.36a2 2 0 1 1 2.83 2.82l-1.77 1.77a2 2 0 1 1 2.83 2.83zM21.5 21.5l-1.4-1.4M3.9 3.9 2.5 2.5M6.4 12.77a2 2 0 1 1-2.83-2.83l1.76-1.77a2 2 0 1 1-2.83-2.83l2.83-2.83a2 2 0 1 1 2.83 2.83l1.77-1.76a2 2 0 1 1 2.83 2.82z"/>',
};

export function icon(name, cls = 'h-5 w-5') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
}

/** Replaces every `<i data-icon="name" class="...">` placeholder in static HTML. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('i[data-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.className || 'h-5 w-5');
  });
}

export const logoHtml = () => `
  <span class="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-accent-fg">
    ${icon('check', 'h-5 w-5')}
  </span>`;

/* ---------- Toasts ---------- */

function toastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4';
    root.style.paddingTop = 'calc(env(safe-area-inset-top, 0px) + 16px)';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

export function toast(message, type = 'success', timeout = 3200) {
  const styles = {
    success: { icon: icon('check', 'h-4 w-4'), iconBg: 'bg-accent text-accent-fg' },
    error: { icon: icon('alert', 'h-4 w-4'), iconBg: 'bg-danger/10 text-danger' },
    info: { icon: icon('sparkles', 'h-4 w-4'), iconBg: 'bg-white/5 text-fg' },
  }[type] ?? {};

  const el = document.createElement('div');
  el.className = 'animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg bg-raised p-4 font-sans text-small text-fg shadow-overlay ring-1 ring-line';
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.iconBg}">${styles.icon}</span><span>${escapeHtml(message)}</span>`;
  toastRoot().appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 260);
  }, timeout);
}

/* ---------- Modals ---------- */

let lastFocused = null;

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  lastFocused = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('[autofocus], input, textarea, button:not([data-close])');
  // Delay focus on touch devices so the sheet animation isn't interrupted by the keyboard
  setTimeout(() => focusable?.focus({ preventScroll: true }), window.matchMedia('(pointer: coarse)').matches ? 320 : 30);
}

export function closeModal(id) {
  const modal = id ? document.getElementById(id) : document.querySelector('[data-modal]:not(.hidden)');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('[data-modal]:not(.hidden)')) document.body.style.overflow = '';
  lastFocused?.focus?.({ preventScroll: true });
}

/** Wires close buttons, backdrop clicks and the Escape key for every `[data-modal]`. */
export function initModals() {
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer.closest('[data-modal]')?.id);
    else if (e.target.matches('[data-modal-backdrop]')) closeModal(e.target.closest('[data-modal]')?.id);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

/* ---------- Buttons ---------- */

export function setLoading(button, loading, loadingText) {
  if (!button) return;
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>${loadingText ? `<span>${escapeHtml(loadingText)}</span>` : ''}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

/* ---------- Lightbox ---------- */

export function openLightbox(src, caption = '') {
  const el = document.createElement('div');
  el.className = 'animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4';
  el.innerHTML = `
    <button class="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-fg hover:bg-white/20" style="top:calc(env(safe-area-inset-top,0px) + 16px)" aria-label="Затвори">${icon('x')}</button>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" class="max-h-full max-w-full rounded-lg object-contain shadow-overlay" style="max-height:80dvh" />
    ${caption ? `<p class="mt-4 font-sans text-small text-muted">${escapeHtml(caption)}</p>` : ''}`;
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  el.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
}

/** Simple confirm dialog returning a Promise<boolean>. */
export function confirmDialog({ title, message, confirmText = 'Потвърди', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fixed inset-0 z-50 flex items-end justify-center font-sans sm:items-center sm:p-6';
    el.innerHTML = `
      <div class="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" data-cancel></div>
      <div class="modal-panel pb-safe relative w-full max-w-sm rounded-t-xl bg-surface p-6 shadow-overlay ring-1 ring-line sm:rounded-xl sm:pb-6" role="alertdialog" aria-modal="true">
        <h3 class="font-display text-title font-semibold text-fg">${escapeHtml(title)}</h3>
        <p class="mt-2 text-small text-muted">${escapeHtml(message)}</p>
        <div class="mt-6 grid grid-cols-2 gap-2">
          <button data-cancel class="h-12 rounded-md bg-raised text-small font-medium text-fg ring-1 ring-line hover:bg-white/5">Отказ</button>
          <button data-ok class="h-12 rounded-md text-small font-semibold ${danger ? 'bg-danger text-canvas hover:opacity-90' : 'bg-accent text-accent-fg hover:opacity-90'}">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    const done = (value) => { el.remove(); resolve(value); };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) done(true);
      else if (e.target.closest('[data-cancel]')) done(false);
    });
    document.body.appendChild(el);
    el.querySelector('[data-ok]').focus();
  });
}
