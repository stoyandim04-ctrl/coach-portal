/**
 * Client app (client.html). Role: client.
 *
 * Routes:  #/          Начало — what do I need to do today?
 *          #/plan      План — my week
 *          #/progress  Прогрес — am I improving?
 *          #/chat      Чат — feedback from my coach
 */
import { getBackend, checkinUrl } from '../services/backend.js';
import { $, escapeHtml, errorMessage, formatNumber, formatInt, formatDelta, formatDate, relativeDays } from '../lib/utils.js';
import { workoutFor, nextCheckin, inDays, normalizeProgram, hasProgram, parseInvite, WEEKDAYS } from '../lib/model.js';
import {
  icon, cx, avatar, pageTitle, sectionTitle, emptyState, skeletonList, bottomNav, sheetHtml,
  hydrateIcons, initModals, openModal, setLoading, toast, openLightbox,
} from '../lib/ui.js';
import { infoRow, weightChart, checkinSummary, checkinBody, photoTimeline, weekLabel } from '../lib/views.js';
import { requireRole, firstName, greeting } from '../lib/session.js';

const view = $('#view');
const state = { backend: null, user: null, me: undefined, checkins: null };

const NAV = [
  { key: 'home', label: 'Начало', icon: 'home', href: '#/' },
  { key: 'plan', label: 'План', icon: 'clipboard', href: '#/plan' },
  { key: 'progress', label: 'Прогрес', icon: 'chart', href: '#/progress' },
  { key: 'chat', label: 'Чат', icon: 'message', href: '#/chat' },
];

function handleError(err) {
  if (err?.code === 'auth/required') return window.location.replace('index.html#login');
  toast(errorMessage(err), 'error');
}

const avatarButton = () => `
  <button type="button" data-action="profile" class="tap -mr-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Профил">
    ${avatar(state.user.name)}
  </button>`;

async function loadData() {
  [state.me, state.checkins] = await Promise.all([state.backend.getMyClient(), state.backend.listMyCheckins()]);
}

/* ---------- Not linked yet ---------- */

function connectCard() {
  const pending = sessionStorage.getItem('cp:invite-error');
  sessionStorage.removeItem('cp:invite-error');
  return `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-title font-semibold">Свържи се с треньора си</h2>
        <p class="text-small text-muted">Постави линка, който получи от треньора.</p>
      </div>
      <form id="connect-form" class="flex flex-col gap-2" novalidate>
        <label class="${cx.field}">
          <span class="${cx.fieldLabel}">Линк от треньора</span>
          <input name="invite" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" class="${cx.input}" />
        </label>
        <p id="connect-error" class="${cx.error} ${pending ? '' : 'hidden'}" role="alert">${escapeHtml(pending ?? '')}</p>
        <button type="submit" class="${cx.btnPrimary} mt-2">Свържи</button>
      </form>
    </div>`;
}

/* ---------- Начало ---------- */

function renderHome() {
  const me = state.me;
  const header = pageTitle(`${greeting()}, ${escapeHtml(firstName(state.user.name))}`, { action: avatarButton() });

  if (!me) {
    view.innerHTML = `<div class="animate-fade-in">${header}${connectCard()}</div>`;
    return;
  }

  const p = normalizeProgram(me.program);
  const workout = workoutFor(p);
  const next = nextCheckin(p, me.lastCheckinAt);
  const due = next.days === 0;
  const feedback = state.checkins.find((c) => String(c.coachNote ?? '').trim());

  const today = hasProgram(p) ? `
    <div class="${cx.list}">
      ${infoRowIcon('dumbbell', 'Тренировка', workout ? escapeHtml(workout) : 'Почивка', '#/plan')}
      ${p.nutrition ? infoRowIcon('utensils', 'Хранене', escapeHtml(p.nutrition.split('\n')[0]), '#/plan') : ''}
      ${p.steps ? infoRowIcon('footprints', 'Стъпки', formatInt(p.steps)) : ''}
    </div>` : `<div class="${cx.card} text-small text-muted">${escapeHtml(me.coachName || 'Треньорът ти')} още подготвя програмата ти.</div>`;

  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      ${header}
      <section>${sectionTitle('Днес')}${today}</section>

      <section>
        ${sectionTitle('Следващ check-in')}
        <div class="${cx.card} flex items-center gap-4">
          <span class="min-w-0 flex-1">
            <span class="block text-body font-medium">${next.weekday}</span>
            <span class="block text-small ${due ? 'text-fg' : 'text-muted'}">${inDays(next.days)}</span>
          </span>
          <a href="${checkinUrl(me.token)}" class="${due ? cx.btnPrimarySm : cx.btnGhost}">${due ? 'Започни' : 'Направи сега'}</a>
        </div>
      </section>

      ${feedback ? `
        <section>
          ${sectionTitle('От треньора', `<a href="#/chat" class="${cx.btnGhost} -mr-3">Всички</a>`)}
          <div class="${cx.card}">
            <p class="whitespace-pre-line text-body">${escapeHtml(feedback.coachNote)}</p>
            <p class="mt-2 text-caption text-subtle">${escapeHtml(me.coachName || 'Треньор')} · ${relativeDays(feedback.coachNoteAt ?? feedback.createdAt)}</p>
          </div>
        </section>` : ''}
    </div>`;
}

function infoRowIcon(iconName, label, value, href = '') {
  const inner = `
    <span class="text-subtle">${icon(iconName)}</span>
    <span class="text-body text-muted">${label}</span>
    <span class="min-w-0 flex-1 truncate text-right text-body text-fg">${value}</span>
    ${href ? `<span class="text-subtle">${icon('chevronRight', 'h-4 w-4')}</span>` : ''}`;
  return href
    ? `<a href="${href}" class="${cx.rowCompact}">${inner}</a>`
    : `<div class="flex min-h-14 items-center gap-3 px-4 py-3">${inner}</div>`;
}

/* ---------- План ---------- */

function renderPlan() {
  const header = pageTitle('План', { action: avatarButton() });
  if (!state.me) return renderNotLinked(header);
  const p = normalizeProgram(state.me.program);
  if (!hasProgram(p)) {
    view.innerHTML = `<div class="animate-fade-in">${header}${emptyState({ iconName: 'clipboard', title: 'Още няма програма', text: 'Ще се появи тук, когато треньорът я въведе.' })}</div>`;
    return;
  }
  const todayIdx = new Date().getDay();
  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      ${header}
      <section>
        ${sectionTitle('Тренировки')}
        <div class="${cx.list}">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => `
            <div class="flex min-h-14 items-center gap-3 px-4 py-3 ${d === todayIdx ? 'bg-raised' : ''}">
              <span class="w-1/3 shrink-0 text-body ${d === todayIdx ? 'font-medium text-fg' : 'text-muted'}">${WEEKDAYS[d]}</span>
              <span class="flex-1 text-body ${p.workouts[d] ? 'text-fg' : 'text-subtle'}">${p.workouts[d] ? escapeHtml(p.workouts[d]) : 'Почивка'}</span>
              ${d === todayIdx ? '<span class="text-caption text-muted">Днес</span>' : ''}
            </div>`).join('')}
        </div>
      </section>
      ${p.nutrition ? `<section>${sectionTitle('Хранене')}<div class="${cx.card}"><p class="whitespace-pre-line text-body">${escapeHtml(p.nutrition)}</p></div></section>` : ''}
      <div class="${cx.list}">
        ${p.steps ? infoRow('Стъпки на ден', formatInt(p.steps)) : ''}
        ${infoRow('Check-in', WEEKDAYS[p.checkinDay])}
      </div>
    </div>`;
}

/* ---------- Прогрес ---------- */

function renderProgress() {
  const header = pageTitle('Прогрес', { action: avatarButton() });
  if (!state.me) return renderNotLinked(header);
  const list = state.checkins;
  if (!list.length) {
    view.innerHTML = `<div class="animate-fade-in">${header}${emptyState({ iconName: 'chart', title: 'Още няма check-ins', text: 'Прогресът ти се появява след първия check-in.', action: `<a href="${checkinUrl(state.me.token)}" class="${cx.btnPrimary}">Направи check-in</a>` })}</div>`;
    return;
  }
  const latest = list[0];
  const first = list[list.length - 1];
  const photos = photoTimeline(list);

  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      ${header}
      <div class="${cx.list}">
        ${infoRow('Тегло', `${formatNumber(latest.weight)} кг`)}
        ${list.length > 1 ? infoRow(`Промяна от ${formatDate(first.createdAt, { day: 'numeric', month: 'short' })}`, formatDelta(latest.weight - first.weight)) : ''}
      </div>
      ${weightChart(list)}
      ${photos ? `<section>${sectionTitle('Снимки')}<div class="flex flex-col gap-6">${photos}</div></section>` : ''}
      <section>
        ${sectionTitle('Check-ins')}
        <div class="flex flex-col gap-2">
          ${list.map((c, i) => `
            <details class="group rounded-md border border-line bg-surface">
              <summary class="tap flex min-h-18 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                ${checkinSummary(c, list[i + 1])}
                <span class="text-subtle transition group-open:rotate-90">${icon('chevronRight', 'h-4 w-4')}</span>
              </summary>
              <div class="border-t border-line p-4">${checkinBody(c, list[i + 1])}</div>
            </details>`).join('')}
        </div>
      </section>
    </div>`;
}

/* ---------- Чат ---------- */

function renderChat() {
  const header = pageTitle('Чат', { action: avatarButton() });
  if (!state.me) return renderNotLinked(header);
  const coach = escapeHtml(state.me.coachName || 'Треньор');
  const thread = [...state.checkins].reverse();

  if (!thread.length) {
    view.innerHTML = `<div class="animate-fade-in">${header}${emptyState({ iconName: 'message', title: 'Още няма съобщения', text: `Отговорите на ${coach} към check-in-ите ти ще се появяват тук.` })}</div>`;
    return;
  }

  view.innerHTML = `
    <div class="animate-fade-in">
      ${header}
      <div class="flex flex-col gap-6">
        ${thread.map((c) => `
          <div class="flex flex-col gap-2">
            <p class="text-center text-caption text-subtle">${weekLabel(c.createdAt)} · ${formatDate(c.createdAt, { day: 'numeric', month: 'short' })}</p>
            <div class="ml-auto max-w-sm rounded-md bg-raised px-4 py-3">
              <p class="text-small text-muted">Check-in · ${formatNumber(c.weight)} кг</p>
              ${c.comment ? `<p class="mt-1 whitespace-pre-line text-body">${escapeHtml(c.comment)}</p>` : ''}
            </div>
            ${String(c.coachNote ?? '').trim() ? `
              <div class="mr-auto max-w-sm rounded-md border border-line bg-surface px-4 py-3">
                <p class="text-small text-muted">${coach}</p>
                <p class="mt-1 whitespace-pre-line text-body">${escapeHtml(c.coachNote)}</p>
              </div>` : '<p class="text-caption text-subtle">Очаква отговор</p>'}
          </div>`).join('')}
      </div>
    </div>`;
  window.scrollTo({ top: document.body.scrollHeight });
}

function renderNotLinked(header) {
  view.innerHTML = `<div class="animate-fade-in">${header}${connectCard()}</div>`;
}

/* ---------- Profile sheet ---------- */

function mountSheets() {
  $('#sheets').innerHTML = sheetHtml('profile-modal', 'profile-title', `
    <div class="flex items-center gap-4 pr-12">
      ${avatar(state.user.name, 'h-14 w-14 text-title')}
      <div class="min-w-0">
        <h2 id="profile-title" class="truncate text-title font-semibold">${escapeHtml(state.user.name)}</h2>
        <p class="truncate text-small text-muted">${escapeHtml(state.user.email)}</p>
      </div>
    </div>
    <div id="profile-coach" class="mt-6"></div>
    <button type="button" data-action="logout" class="${cx.btnSecondary} mt-6 w-full">${icon('logout', 'h-4 w-4')} Изход</button>`);
}

/* ---------- Events ---------- */

function bindEvents() {
  document.addEventListener('click', async (e) => {
    const photo = e.target.closest('[data-photo]');
    if (photo) return openLightbox(photo.dataset.photo, photo.dataset.caption);
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'profile') {
      $('#profile-coach').innerHTML = state.me
        ? `<div class="${cx.list}">${infoRow('Треньор', escapeHtml(state.me.coachName || '—'))}</div>`
        : '';
      openModal('profile-modal');
    } else if (action === 'logout') {
      await state.backend.logout();
      window.location.replace('index.html');
    }
  });

  view.addEventListener('submit', async (e) => {
    if (e.target.id !== 'connect-form') return;
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('[type=submit]');
    const errorEl = $('#connect-error');
    const token = parseInvite(new FormData(form).get('invite'));
    errorEl.classList.add('hidden');
    if (!token) {
      errorEl.textContent = 'Постави целия линк, който получи от треньора.';
      errorEl.classList.remove('hidden');
      return;
    }
    setLoading(button, true);
    try {
      await state.backend.claimInvite(token);
      await loadData();
      toast('Свързан си с треньора си');
      route();
    } catch (err) {
      errorEl.textContent = errorMessage(err);
      errorEl.classList.remove('hidden');
      setLoading(button, false);
    }
  });
}

/* ---------- Router ---------- */

function route() {
  const page = window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
  const active = NAV.some((n) => n.key === page) ? page : 'home';
  $('#nav').innerHTML = bottomNav(NAV.map((n) => (n.key === 'chat' ? { ...n, badge: hasUnreadReply() } : n)), active);
  window.scrollTo({ top: 0 });
  if (active === 'plan') renderPlan();
  else if (active === 'progress') renderProgress();
  else if (active === 'chat') renderChat();
  else renderHome();
}

function hasUnreadReply() {
  const latest = state.checkins?.[0];
  return Boolean(latest && String(latest.coachNote ?? '').trim() && Date.now() - (latest.coachNoteAt ?? 0) < 3 * 24 * 60 * 60 * 1000);
}

async function main() {
  hydrateIcons();
  initModals();
  try {
    state.backend = await getBackend();
    state.user = await requireRole(state.backend, 'client');
    if (!state.user) return;
    view.innerHTML = `<div class="pt-16">${skeletonList(3)}</div>`;
    await loadData();
    mountSheets();
    bindEvents();
    window.addEventListener('hashchange', route);
    route();
  } catch (err) {
    handleError(err);
  }
}

main();
