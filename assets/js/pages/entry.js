/**
 * Public entry: welcome · login · role selection · registration (coach / client) · invite.
 * Hash views: '' welcome, #login, #register (role), #register-coach, #register-client.
 * `?invite=<token>` comes from a coach's invite link.
 */
import { getBackend, checkinUrl } from '../services/backend.js';
import { $, errorMessage, escapeHtml } from '../lib/utils.js';
import { ROLES, APP_NAME } from '../lib/model.js';
import { icon, cx, subHeader, setLoading, toast } from '../lib/ui.js';
import { homeFor } from '../lib/session.js';

const app = $('#app');
const inviteToken = new URLSearchParams(window.location.search).get('invite');
let backend;
let invite = null; // { clientName, coachName, claimed }

/* ---------- Shared fragments ---------- */

const logo = () => `
  <div class="flex items-center gap-2">
    <span class="flex h-8 w-8 items-center justify-center rounded-sm bg-fg text-canvas">${icon('check', 'h-5 w-5')}</span>
    <span class="text-body font-semibold">${APP_NAME}</span>
  </div>`;

function field({ id, label, type = 'text', autocomplete, placeholder = '', inputmode = '' }) {
  return `
    <label class="${cx.field}">
      <span class="${cx.fieldLabel}">${label}</span>
      <input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" ${inputmode ? `inputmode="${inputmode}"` : ''}
        placeholder="${placeholder}" class="${cx.input}" required />
    </label>`;
}

function passwordField(autocomplete) {
  return `
    <div class="${cx.fieldRow} py-2 pr-2">
      <label for="password" class="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <span class="${cx.fieldLabel}">Парола</span>
        <input id="password" name="password" type="password" autocomplete="${autocomplete}" placeholder="Поне 6 символа" class="${cx.input}" required minlength="6" />
      </label>
      <button type="button" data-toggle-password class="${cx.iconBtn}" aria-label="Покажи паролата" aria-pressed="false">${icon('eye')}</button>
    </div>`;
}

const errorBox = () => `<p id="form-error" class="${cx.error} hidden" role="alert"></p>`;

function showError(err) {
  const el = $('#form-error');
  el.textContent = errorMessage(err);
  el.classList.remove('hidden');
}

/* ---------- After auth ---------- */

async function finish(user) {
  if (user.role === ROLES.client && inviteToken) {
    try {
      await backend.claimInvite(inviteToken);
    } catch (err) {
      // Already linked to this coach is fine; anything else is shown on the client home.
      if (err?.code !== 'invite/has-coach') sessionStorage.setItem('cp:invite-error', errorMessage(err));
    }
  }
  window.location.replace(homeFor(user));
}

/* ---------- Views ---------- */

function viewWelcome() {
  const inviteBlock = invite ? `
    <div class="${cx.card} flex items-center gap-3">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-raised text-muted">${icon('user')}</span>
      <p class="text-small text-muted"><span class="text-fg">${escapeHtml(invite.coachName || 'Треньорът ти')}</span> те покани в ${APP_NAME}.</p>
    </div>` : '';

  app.innerHTML = `
    <header class="flex h-14 items-center">${logo()}</header>
    <section class="animate-fade-in flex flex-1 flex-col justify-center gap-3 py-12">
      <h1 class="text-headline font-semibold" style="text-wrap: balance">Всичко за твоето coaching на едно място.</h1>
      <p class="text-body text-muted">Клиенти, прогрес, програми и check-ins.</p>
    </section>
    <section class="flex flex-col gap-2 pb-4">
      ${inviteBlock}
      <a href="#login" class="${cx.btnSecondary}">Вход</a>
      <a href="${invite ? '#register-client' : '#register'}" class="${cx.btnPrimary}">Създай акаунт</a>
      ${invite ? `<a href="${checkinUrl(inviteToken)}" class="${cx.btnGhost}">Изпрати check-in без акаунт</a>` : ''}
      ${backend.seedDemo && !invite ? `
        <div class="flex items-center justify-center gap-1 pt-2 text-caption text-subtle">
          <span>Демо:</span>
          <button type="button" data-demo="coach" class="tap rounded-sm px-2 py-1 text-muted underline underline-offset-4 hover:text-fg">треньор</button>
          <span aria-hidden="true">·</span>
          <button type="button" data-demo="client" class="tap rounded-sm px-2 py-1 text-muted underline underline-offset-4 hover:text-fg">клиент</button>
        </div>` : ''}
    </section>`;

  app.querySelectorAll('[data-demo]').forEach((btn) => btn.addEventListener('click', async () => {
    setLoading(btn, true);
    try {
      await finish(await backend.seedDemo(btn.dataset.demo));
    } catch (err) {
      toast(errorMessage(err), 'error');
      setLoading(btn, false);
    }
  }));
}

function viewLogin() {
  app.innerHTML = `
    ${subHeader('', { back: '#' })}
    <section class="animate-fade-in flex flex-1 flex-col gap-8 pt-4">
      <div class="flex flex-col gap-1">
        <p class="text-small text-muted">${APP_NAME}</p>
        <h1 class="text-headline font-semibold">Добре дошъл обратно</h1>
      </div>
      <form id="auth-form" class="flex flex-col gap-2" novalidate>
        ${field({ id: 'email', label: 'Имейл', type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@email.com' })}
        ${passwordField('current-password')}
        ${errorBox()}
        <button type="submit" class="${cx.btnPrimary} mt-4">Вход</button>
      </form>
      <p class="text-center text-small text-muted">Нямаш акаунт? <a href="${invite ? '#register-client' : '#register'}" class="text-fg underline underline-offset-4">Създай акаунт</a></p>
    </section>`;

  bindForm(async (data) => backend.login(data), 'Влизане…');
}

function viewRole() {
  const option = (role, iconName, title, text) => `
    <a href="#register-${role}" class="${cx.row} rounded-md border border-line bg-surface">
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-raised text-fg">${icon(iconName)}</span>
      <span class="min-w-0 flex-1">
        <span class="block text-body font-medium">${title}</span>
        <span class="block text-small text-muted">${text}</span>
      </span>
      <span class="text-subtle">${icon('chevronRight')}</span>
    </a>`;

  app.innerHTML = `
    ${subHeader('', { back: '#' })}
    <section class="animate-fade-in flex flex-1 flex-col gap-8 pt-4">
      <h1 class="text-headline font-semibold" style="text-wrap: balance">Как ще използваш ${APP_NAME}?</h1>
      <div class="flex flex-col gap-2">
        ${option(ROLES.coach, 'clipboard', 'Аз съм треньор', 'Управлявам клиенти, програми и check-ins.')}
        ${option(ROLES.client, 'dumbbell', 'Тренирам с треньор', 'Следя програмата, прогреса и задачите си.')}
      </div>
      <p class="text-center text-small text-muted">Имаш акаунт? <a href="#login" class="text-fg underline underline-offset-4">Вход</a></p>
    </section>`;
}

function viewRegister(role) {
  const isCoach = role === ROLES.coach;
  const title = isCoach ? 'Акаунт за треньор' : 'Акаунт за клиент';
  const lead = isCoach
    ? 'След регистрация добавяш клиентите си и им изпращаш покана.'
    : invite
      ? `Ще бъдеш свързан с ${escapeHtml(invite.coachName || 'треньора си')}.`
      : 'След регистрация се свързваш с треньора си чрез линка от него.';

  app.innerHTML = `
    ${subHeader('', { back: invite ? '#' : '#register' })}
    <section class="animate-fade-in flex flex-1 flex-col gap-8 pt-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-headline font-semibold">${title}</h1>
        <p class="text-small text-muted">${lead}</p>
      </div>
      <form id="auth-form" class="flex flex-col gap-2" novalidate>
        ${field({ id: 'name', label: 'Име и фамилия', autocomplete: 'name', placeholder: isCoach ? 'Иван Иванов' : invite?.clientName ?? 'Мария Петрова' })}
        ${field({ id: 'email', label: 'Имейл', type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'name@email.com' })}
        ${passwordField('new-password')}
        ${errorBox()}
        <button type="submit" class="${cx.btnPrimary} mt-4">Създай акаунт</button>
      </form>
      <p class="text-center text-small text-muted">Имаш акаунт? <a href="#login" class="text-fg underline underline-offset-4">Вход</a></p>
    </section>`;

  if (invite?.clientName) $('#name').value = invite.clientName;
  bindForm(async (data) => backend.register({ ...data, role }), 'Създаване…');
}

function bindForm(submit, loadingText) {
  const form = $('#auth-form');
  form.querySelector('[data-toggle-password]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const input = $('#password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Скрий паролата' : 'Покажи паролата');
    btn.innerHTML = icon(show ? 'eyeOff' : 'eye');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('[type=submit]');
    const fd = new FormData(form);
    $('#form-error').classList.add('hidden');
    setLoading(button, true, loadingText);
    try {
      await finish(await submit({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') }));
    } catch (err) {
      showError(err);
      setLoading(button, false);
    }
  });
  if (!window.matchMedia('(pointer: coarse)').matches) form.querySelector('input')?.focus();
}

/* ---------- Router ---------- */

function route() {
  const view = window.location.hash.replace('#', '');
  window.scrollTo({ top: 0 });
  if (view === 'login') viewLogin();
  else if (view === 'register') invite ? viewRegister(ROLES.client) : viewRole();
  else if (view === 'register-coach' && !invite) viewRegister(ROLES.coach);
  else if (view === 'register-client') viewRegister(ROLES.client);
  else viewWelcome();
}

async function main() {
  try {
    backend = await getBackend();
    if (inviteToken) invite = await backend.getCheckinContext(inviteToken);

    // Signed-in users never see the entry screens.
    const user = await backend.getCurrentUser();
    if (user) {
      await finish(user);
      return;
    }

    window.addEventListener('hashchange', route);
    route();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="flex flex-1 items-center justify-center text-small text-danger">${escapeHtml(errorMessage(err))}</div>`;
  }
}

main();
