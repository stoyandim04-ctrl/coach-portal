/**
 * Landing / Auth page (index.html).
 * Opens the auth sheet from `#login` / `#register` hashes (used by dashboard redirects).
 */
import { getBackend } from '../services/backend.js';
import { $, $$, errorMessage } from '../lib/utils.js';
import { hydrateIcons, initModals, openModal, setLoading, toast, icon } from '../lib/ui.js';

const DASHBOARD = 'dashboard.html';

const COPY = {
  login: { title: 'Вход за треньор', subtitle: 'Добре дошъл отново 👋', submit: 'Влез', autocomplete: 'current-password' },
  register: { title: 'Създай акаунт', subtitle: 'Безплатно по време на бета версията.', submit: 'Създай акаунт', autocomplete: 'new-password' },
};

let mode = 'login';
let backend;

function setMode(next) {
  mode = next;
  const copy = COPY[mode];
  $('#auth-title').textContent = copy.title;
  $('#auth-subtitle').textContent = copy.subtitle;
  $('#auth-submit').textContent = copy.submit;
  $('#password').setAttribute('autocomplete', copy.autocomplete);
  $('#field-name').classList.toggle('hidden', mode !== 'register');
  $('#auth-error').classList.add('hidden');

  $$('[data-tab]').forEach((tab) => {
    const active = tab.dataset.tab === mode;
    tab.setAttribute('aria-selected', String(active));
    tab.classList.toggle('bg-ink-700', active);
    tab.classList.toggle('text-white', active);
    tab.classList.toggle('text-zinc-500', !active);
  });
}

function openAuth(nextMode) {
  setMode(nextMode);
  openModal('auth-modal');
  if (nextMode === 'register') setTimeout(() => $('#name').focus({ preventScroll: true }), 350);
}

function showError(message) {
  const el = $('#auth-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

async function onSubmit(e) {
  e.preventDefault();
  const button = $('#auth-submit');
  const form = new FormData(e.currentTarget);
  const data = { name: form.get('name'), email: form.get('email'), password: form.get('password') };

  $('#auth-error').classList.add('hidden');
  setLoading(button, true, mode === 'login' ? 'Влизане…' : 'Създаване…');
  try {
    if (mode === 'login') await backend.login(data);
    else await backend.register(data);
    window.location.href = DASHBOARD;
  } catch (err) {
    showError(errorMessage(err));
    setLoading(button, false);
  }
}

async function startDemo(button) {
  setLoading(button, true, 'Зареждане…');
  try {
    await backend.seedDemo();
    window.location.href = DASHBOARD;
  } catch (err) {
    toast(errorMessage(err), 'error');
    setLoading(button, false);
  }
}

async function main() {
  hydrateIcons();
  initModals();
  $('#year').textContent = new Date().getFullYear();

  $$('[data-auth]').forEach((btn) => btn.addEventListener('click', () => openAuth(btn.dataset.auth)));
  $$('[data-tab]').forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.tab)));
  $('#auth-form').addEventListener('submit', onSubmit);

  backend = await getBackend();

  if (typeof backend.seedDemo === 'function') {
    $('#demo-btn').classList.remove('hidden');
    $('#demo-hint').classList.remove('hidden');
    $('#demo-btn').addEventListener('click', (e) => startDemo(e.currentTarget));
    $('#demo-btn-modal').addEventListener('click', (e) => startDemo(e.currentTarget));
  }

  const coach = await backend.getCurrentCoach();
  if (coach) {
    $('#header-actions').innerHTML = `
      <a href="${DASHBOARD}" class="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink-950 hover:bg-brand-400">
        Към панела ${icon('arrowRight', 'h-4 w-4')}
      </a>`;
  }

  const hash = window.location.hash.replace('#', '');
  if (hash === 'login' || hash === 'register') {
    history.replaceState(null, '', window.location.pathname);
    if (!coach) openAuth(hash);
  }
}

main();
