/**
 * Coach Portal UI kit — the only place component styling lives (DESIGN.md §7).
 * Pages compose these helpers instead of styling elements themselves.
 */
import { escapeHtml, initials } from './utils.js';

/* =========================================================================
   Icons (Lucide, stroke 2)
   ========================================================================= */

const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0zM20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0zM16 17h4M4 13h4"/>',
  scale: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.9 3.14 9.94 6.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49M14.08 14.16a3 3 0 0 1-4.24-4.24M17.48 17.5A10.75 10.75 0 0 1 2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14M2 2l20 20"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
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

/* =========================================================================
   Class recipes (DESIGN.md §7). Use these — never re-style per page.
   ========================================================================= */

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export const cx = {
  btnPrimary: `tap inline-flex h-12 items-center justify-center gap-2 rounded-md bg-fg px-5 text-body font-medium text-canvas hover:bg-white disabled:opacity-50 ${FOCUS}`,
  btnSecondary: `tap inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-body font-medium text-fg hover:bg-raised disabled:opacity-50 ${FOCUS}`,
  btnPrimarySm: `tap inline-flex h-11 items-center justify-center gap-2 rounded-md bg-fg px-4 text-small font-medium text-canvas hover:bg-white disabled:opacity-50 ${FOCUS}`,
  btnGhost: `tap inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-small font-medium text-muted hover:bg-surface hover:text-fg ${FOCUS}`,
  btnGhostDanger: `tap inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-small font-medium text-danger hover:bg-surface ${FOCUS}`,
  btnDanger: `tap inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-body font-medium text-danger hover:bg-raised ${FOCUS}`,
  iconBtn: `tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-fg ${FOCUS}`,
  field: 'flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3 transition focus-within:border-accent',
  fieldRow: 'flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 transition focus-within:border-accent',
  fieldLabel: 'text-caption text-subtle',
  input: 'w-full bg-transparent text-body text-fg placeholder-subtle focus:outline-none',
  list: 'flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-surface',
  row: `tap flex min-h-18 items-center gap-3 px-4 py-3 hover:bg-raised ${FOCUS}`,
  rowCompact: `tap flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-raised ${FOCUS}`,
  card: 'rounded-md border border-line bg-surface p-4',
  error: 'rounded-md border border-danger bg-surface p-3 text-small text-danger',
};

/* =========================================================================
   Components (return HTML strings)
   ========================================================================= */

export function avatar(name, size = 'h-10 w-10 text-small') {
  return `<span class="flex ${size} shrink-0 items-center justify-center rounded-full bg-raised font-medium text-fg">${escapeHtml(initials(name))}</span>`;
}

export function statusDot(status, extra = '') {
  return `<span class="inline-block h-2 w-2 shrink-0 rounded-full ${status.dot} ${extra}" aria-hidden="true"></span>`;
}

/** Large page title used on top-level tabs. */
export function pageTitle(title, { eyebrow = '', action = '' } = {}) {
  return `
    <header class="flex items-end justify-between gap-4 pb-6 pt-4">
      <div class="min-w-0">
        ${eyebrow ? `<p class="text-small text-muted">${eyebrow}</p>` : ''}
        <h1 class="truncate text-headline font-semibold">${title}</h1>
      </div>
      ${action}
    </header>`;
}

/** Compact header for pushed screens (back button + title). */
export function subHeader(title, { back = '#/', action = '' } = {}) {
  return `
    <header class="flex h-14 items-center gap-1">
      <a href="${back}" class="${cx.iconBtn} -ml-3" aria-label="Назад">${icon('chevronLeft', 'h-6 w-6')}</a>
      <h1 class="min-w-0 flex-1 truncate text-body font-semibold">${title}</h1>
      ${action}
    </header>`;
}

export function sectionTitle(title, action = '') {
  return `<div class="flex items-center justify-between gap-4 pb-3"><h2 class="text-title font-semibold">${title}</h2>${action}</div>`;
}

export function emptyState({ iconName = 'inbox', title, text = '', action = '' }) {
  return `
    <div class="flex flex-col items-center px-6 py-12 text-center">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">${icon(iconName)}</span>
      <p class="mt-4 text-body font-medium">${title}</p>
      ${text ? `<p class="mt-1 max-w-xs text-small text-muted">${text}</p>` : ''}
      ${action ? `<div class="mt-6">${action}</div>` : ''}
    </div>`;
}

export function skeletonList(rows = 4) {
  return `<div class="flex flex-col gap-2">${'<div class="skeleton h-18 rounded-md"></div>'.repeat(rows)}</div>`;
}

/** Horizontally scrollable segmented control. `tabs`: [{ key, label }]. */
export function segmented(tabs, active, attr = 'data-tab') {
  return `
    <div class="no-scrollbar -mx-4 overflow-x-auto px-4" role="tablist">
      <div class="inline-flex min-w-full gap-1 rounded-md bg-surface p-1">
        ${tabs.map((t) => `
          <button type="button" role="tab" ${attr}="${t.key}" aria-selected="${t.key === active}"
            class="tap h-9 flex-1 whitespace-nowrap rounded-sm px-3 text-small font-medium ${FOCUS} ${t.key === active ? 'bg-raised text-fg' : 'text-muted hover:text-fg'}">${t.label}</button>`).join('')}
      </div>
    </div>`;
}

/**
 * Persistent bottom navigation. `items`: [{ key, label, icon, href, primary? }].
 * A `primary` item renders as the central action button.
 */
export function bottomNav(items, active) {
  return `
    <nav class="app-nav fixed inset-x-0 bottom-0 z-30 border-t border-line bg-canvas" aria-label="Основна навигация">
      <div class="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2">
        ${items.map((it) => it.primary
          ? `<button type="button" data-nav-action="${it.key}" class="tap flex flex-1 items-center justify-center ${FOCUS}" aria-label="${it.label}">
               <span class="flex h-10 w-10 items-center justify-center rounded-md bg-fg text-canvas">${icon(it.icon, 'h-5 w-5')}</span>
             </button>`
          : `<a href="${it.href}" class="tap flex flex-1 flex-col items-center justify-center gap-1 ${FOCUS} ${it.key === active ? 'text-fg' : 'text-subtle hover:text-muted'}" ${it.key === active ? 'aria-current="page"' : ''}>
               <span class="relative">${icon(it.icon, 'h-5 w-5')}${it.badge ? '<span class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-canvas"></span>' : ''}</span>
               <span class="text-caption font-medium">${it.label}${it.badge ? '<span class="sr-only"> (ново)</span>' : ''}</span>
             </a>`).join('')}
      </div>
    </nav>`;
}

/* =========================================================================
   Toasts
   ========================================================================= */

function toastRoot() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.className = 'pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4';
    root.style.paddingTop = 'calc(env(safe-area-inset-top, 0px) + 12px)';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

export function toast(message, type = 'success', timeout = 2800) {
  const tone = { success: 'text-success', error: 'text-danger', info: 'text-muted' }[type] ?? 'text-muted';
  const iconName = { success: 'check', error: 'alert', info: 'clock' }[type] ?? 'check';
  const el = document.createElement('div');
  el.className = 'animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-md border border-line bg-raised px-4 py-3 font-sans text-small text-fg';
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="${tone}">${icon(iconName, 'h-5 w-5')}</span><span>${escapeHtml(message)}</span>`;
  toastRoot().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, timeout);
}

/* =========================================================================
   Sheets (bottom sheet on phones, dialog on desktop)
   ========================================================================= */

let lastFocused = null;

/** Wraps content in sheet chrome. Static sheets use the same markup in HTML. */
export function sheetHtml(id, titleId, inner) {
  return `
    <div id="${id}" data-modal class="fixed inset-0 z-40 hidden" role="dialog" aria-modal="true" aria-labelledby="${titleId}" aria-hidden="true">
      <div data-modal-backdrop class="animate-fade-in absolute inset-0 bg-black/60"></div>
      <div class="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <div class="modal-panel pb-safe pointer-events-auto relative max-h-full w-full overflow-y-auto rounded-t-lg border border-line bg-surface px-4 pt-3 shadow-sheet sm:max-w-md sm:rounded-lg sm:p-6">
          <div class="mx-auto mb-4 h-1 w-8 rounded-full bg-line sm:hidden"></div>
          <button data-close class="${cx.iconBtn} absolute right-2 top-2" aria-label="Затвори">${icon('x')}</button>
          ${inner}
        </div>
      </div>
    </div>`;
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  lastFocused = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('[autofocus], input, textarea');
  // Wait for the sheet animation on touch devices so the keyboard doesn't interrupt it
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

/** Wires close buttons, backdrop taps and the Escape key for every `[data-modal]`. */
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

/* =========================================================================
   Misc
   ========================================================================= */

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

export function openLightbox(src, caption = '') {
  const el = document.createElement('div');
  el.className = 'animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4';
  el.innerHTML = `
    <button class="${cx.iconBtn} absolute right-4" style="top:calc(env(safe-area-inset-top,0px) + 12px)" aria-label="Затвори">${icon('x')}</button>
    <img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}" class="max-h-full max-w-full rounded-md object-contain" style="max-height:80dvh" />
    ${caption ? `<p class="mt-4 font-sans text-small text-muted">${escapeHtml(caption)}</p>` : ''}`;
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => e.key === 'Escape' && close();
  el.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
}

/** Confirm sheet returning a Promise<boolean>. */
export function confirmDialog({ title, message, confirmText = 'Потвърди', danger = false }) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fixed inset-0 z-50 flex items-end justify-center font-sans sm:items-center sm:p-6';
    el.innerHTML = `
      <div class="animate-fade-in absolute inset-0 bg-black/60" data-cancel></div>
      <div class="modal-panel pb-safe relative w-full max-w-sm rounded-t-lg border border-line bg-surface p-6 shadow-sheet sm:rounded-lg sm:pb-6" role="alertdialog" aria-modal="true">
        <h3 class="text-title font-semibold text-fg">${escapeHtml(title)}</h3>
        <p class="mt-2 text-small text-muted">${escapeHtml(message)}</p>
        <div class="mt-6 flex flex-col gap-2">
          <button data-ok class="${danger ? cx.btnDanger : cx.btnPrimary}">${escapeHtml(confirmText)}</button>
          <button data-cancel class="${cx.btnSecondary}">Отказ</button>
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

/** Copies via the Web Share sheet on phones, clipboard elsewhere. */
export async function shareOrCopy({ title, text, url }, copyFn) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyFn(url)) ? 'copied' : 'failed';
}
