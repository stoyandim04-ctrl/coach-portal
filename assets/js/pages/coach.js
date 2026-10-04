/**
 * Coach app (coach.html). Role: coach.
 *
 * Routes:  #/                    Начало — what needs my attention?
 *          #/clients[/filter]    Клиенти — who am I coaching?
 *          #/client/:id[/tab]    Client profile — how is this client doing?
 *          #/messages            Съобщения — check-ins waiting for a reply
 *          #/profile             Профил
 */
import { getBackend, inviteUrl } from '../services/backend.js';
import {
  $, escapeHtml, errorMessage, formatNumber, formatDelta, formatDate, formatDateTime, relativeDays, daysSince, copyToClipboard, debounce,
} from '../lib/utils.js';
import {
  checkinStatus, attentionItems, byAttention, nextCheckin, inDays, normalizeProgram, hasProgram, WEEKDAYS, WEEKDAYS_SHORT,
} from '../lib/model.js';
import {
  icon, cx, avatar, pageTitle, subHeader, sectionTitle, emptyState, skeletonList, segmented, bottomNav, sheetHtml,
  hydrateIcons, initModals, openModal, closeModal, setLoading, toast, openLightbox, confirmDialog, shareOrCopy,
} from '../lib/ui.js';
import { clientRow, infoRow, weightChart, checkinSummary, checkinBody, photoTimeline, weekLabel } from '../lib/views.js';
import { requireRole, firstName, greeting, todayLabel } from '../lib/session.js';

const view = $('#view');
const state = { backend: null, user: null, clients: null, lastCreated: null, client: null, checkins: [], search: '', filter: 'all', base: '' };

/* =========================================================================
   Shell
   ========================================================================= */

const NAV = [
  { key: 'home', label: 'Начало', icon: 'home', href: '#/' },
  { key: 'clients', label: 'Клиенти', icon: 'users', href: '#/clients' },
  { key: 'add', label: 'Нов клиент', icon: 'plus', primary: true },
  { key: 'messages', label: 'Съобщения', icon: 'message', href: '#/messages' },
  { key: 'profile', label: 'Профил', icon: 'user', href: '#/profile' },
];

function renderNav(active) {
  const waiting = (state.clients ?? []).some((c) => c.awaitingReply);
  $('#nav').innerHTML = bottomNav(NAV.map((n) => (n.key === 'messages' ? { ...n, badge: waiting } : n)), active);
}

function handleError(err) {
  if (err?.code === 'auth/required') return window.location.replace('index.html#login');
  toast(errorMessage(err), 'error');
}

async function loadClients() {
  state.clients = await state.backend.listClients();
}

async function share(client) {
  const result = await shareOrCopy(
    { title: 'Coach Portal', text: `Здравей, ${firstName(client.name)}! Това е твоят линк за Coach Portal:`, url: inviteUrl(client.token) },
    copyToClipboard,
  );
  if (result === 'copied') toast('Линкът е копиран');
  else if (result === 'failed') toast('Неуспешно копиране', 'error');
}

/* =========================================================================
   Начало
   ========================================================================= */

function renderHome() {
  const clients = state.clients;
  const items = attentionItems(clients);
  const top = [...clients].sort(byAttention).slice(0, 5);

  view.innerHTML = `
    <div class="animate-fade-in">
      ${pageTitle(`${greeting()}, ${escapeHtml(firstName(state.user.name))}`, { eyebrow: todayLabel() })}

      <section class="pb-8">
        ${sectionTitle('Днес')}
        ${!clients.length ? '' : items.length ? `
          <div class="${cx.list}">
            ${items.map((i) => `
              <a href="#/clients/${i.key}" class="${cx.rowCompact}">
                <span class="h-2 w-2 shrink-0 rounded-full ${i.dot}" aria-hidden="true"></span>
                <span class="flex-1 text-body">${i.label}</span>
                <span class="text-subtle">${icon('chevronRight', 'h-4 w-4')}</span>
              </a>`).join('')}
          </div>` : `
          <div class="${cx.card} flex items-center gap-3">
            <span class="text-success">${icon('check')}</span>
            <p class="text-body text-muted">Няма чакащи задачи.</p>
          </div>`}
        ${!clients.length ? `<div class="${cx.card}">${emptyState({ iconName: 'users', title: 'Добави първия си клиент', text: 'Ще получиш линк, който да му изпратиш.', action: `<button type="button" data-action="add-client" class="${cx.btnPrimary}">${icon('plus')} Нов клиент</button>` })}</div>` : ''}
      </section>

      ${clients.length ? `
        <section>
          ${sectionTitle('Клиенти', `<a href="#/clients" class="${cx.btnGhost} -mr-3">Всички</a>`)}
          <div class="${cx.list}">${top.map((c) => clientRow(c, `#/client/${encodeURIComponent(c.id)}`)).join('')}</div>
        </section>` : ''}
    </div>`;
}

/* =========================================================================
   Клиенти
   ========================================================================= */

const FILTERS = [
  { key: 'all', label: 'Всички' },
  { key: 'reply', label: 'Чакат отговор' },
  { key: 'late', label: 'Закъсняват' },
  { key: 'none', label: 'Без check-in' },
];

function matchesFilter(c, filter) {
  const s = checkinStatus(c.lastCheckinAt).key;
  if (filter === 'reply') return c.awaitingReply;
  if (filter === 'late') return s === 'late' || s === 'due';
  if (filter === 'none') return s === 'none';
  return true;
}

function renderClients(filter = 'all') {
  view.innerHTML = `
    <div class="animate-fade-in">
      ${pageTitle('Клиенти', { action: `<button type="button" data-action="add-client" class="${cx.iconBtn} -mr-3" aria-label="Нов клиент">${icon('plus', 'h-6 w-6')}</button>` })}
      ${state.clients.length ? `
        <div class="flex flex-col gap-3 pb-4">
          <label class="relative block">
            <span class="sr-only">Търси клиент</span>
            <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-subtle">${icon('search', 'h-4 w-4')}</span>
            <input id="client-search" type="search" value="${escapeHtml(state.search)}" placeholder="Търси" autocomplete="off"
              class="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-4 text-body text-fg placeholder-subtle focus:border-accent focus:outline-none" />
          </label>
          ${segmented(FILTERS, filter, 'data-filter')}
        </div>
        <div id="client-list"></div>` : `
        <div class="${cx.card}">${emptyState({ iconName: 'users', title: 'Още нямаш клиенти', action: `<button type="button" data-action="add-client" class="${cx.btnPrimary}">${icon('plus')} Нов клиент</button>` })}</div>`}
    </div>`;
  state.filter = filter;
  renderClientList();
}

function renderClientList() {
  const list = $('#client-list');
  if (!list) return;
  const term = state.search.trim().toLowerCase();
  const { filter } = state;
  const rows = state.clients
    .filter((c) => matchesFilter(c, filter))
    .filter((c) => !term || c.name.toLowerCase().includes(term))
    .sort(byAttention);
  list.innerHTML = rows.length
    ? `<div class="${cx.list}">${rows.map((c) => clientRow(c, `#/client/${encodeURIComponent(c.id)}`)).join('')}</div>`
    : `<p class="py-12 text-center text-small text-subtle">Няма клиенти тук.</p>`;
}

/* =========================================================================
   Client profile
   ========================================================================= */

const TABS = [
  { key: 'overview', label: 'Преглед' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'progress', label: 'Прогрес' },
  { key: 'program', label: 'Програма' },
  { key: 'notes', label: 'Бележки' },
];

function coachingSince(ts) {
  const days = daysSince(ts);
  if (days < 7) return 'от тази седмица';
  if (days < 60) return `от ${Math.floor(days / 7)} седм.`;
  return `от ${Math.floor(days / 30)} мес.`;
}

async function renderClient(id, tab = 'overview') {
  const sameClient = state.client?.id === id;
  if (!sameClient) {
    view.innerHTML = `${subHeader('', { back: '#/clients' })}<div class="flex flex-col gap-2 pt-4"><div class="skeleton h-18 rounded-md"></div><div class="skeleton h-chart rounded-md"></div></div>`;
    try {
      const [client, checkins] = await Promise.all([state.backend.getClient(id), state.backend.listCheckins(id)]);
      state.client = client;
      state.checkins = checkins;
    } catch (err) {
      handleError(err);
      window.location.hash = '#/clients';
      return;
    }
  }

  const c = state.client;
  const status = checkinStatus(c.lastCheckinAt);
  const active = status.key === 'ok' ? 'Активен' : status.key === 'none' ? 'Нов клиент' : 'Неактивен';
  const base = `#/client/${encodeURIComponent(c.id)}`;

  view.innerHTML = `
    <div class="animate-fade-in">
      ${subHeader('', { back: '#/clients', action: `<button type="button" data-action="share" class="${cx.iconBtn} -mr-3" aria-label="Сподели линка">${icon('share')}</button>` })}
      <section class="flex items-center gap-4 pb-6">
        ${avatar(c.name, 'h-14 w-14 text-title')}
        <div class="min-w-0">
          <h1 class="truncate text-title font-semibold">${escapeHtml(c.name)}</h1>
          <p class="flex items-center gap-2 text-small text-muted"><span class="h-2 w-2 rounded-full ${status.dot}" aria-hidden="true"></span>${active} · ${coachingSince(c.createdAt)}</p>
        </div>
      </section>
      <div class="sticky z-10 bg-canvas pb-4 pt-2" style="top: env(safe-area-inset-top, 0px)">${segmented(TABS, tab, 'data-client-tab')}</div>
      <div id="tab-body">${tabBody(tab)}</div>
    </div>`;
  state.base = base;
  if (tab === 'notes') loadNotes();
}

function tabBody(tab) {
  if (tab === 'checkins') return tabCheckins();
  if (tab === 'progress') return tabProgress();
  if (tab === 'program') return tabProgram();
  if (tab === 'notes') return `<div class="skeleton h-chart rounded-md"></div>`;
  return tabOverview();
}

function tabOverview() {
  const c = state.client;
  const latest = state.checkins[0];
  const first = state.checkins[state.checkins.length - 1];
  const change = state.checkins.length > 1 ? latest.weight - first.weight : null;
  const next = nextCheckin(c.program, c.lastCheckinAt);
  const status = checkinStatus(c.lastCheckinAt);
  const base = `#/client/${encodeURIComponent(c.id)}`;

  const alerts = [
    c.awaitingReply && { text: 'Нов check-in чака отговор', dot: 'bg-accent', href: `${base}/checkins` },
    (status.key === 'late' || status.key === 'due') && { text: `${status.label} · ${relativeDays(c.lastCheckinAt)}`, dot: status.dot },
    !c.claimed && { text: 'Още няма акаунт · изпрати покана', dot: 'bg-subtle', action: 'share' },
    !hasProgram(c.program) && { text: 'Няма въведена програма', dot: 'bg-subtle', href: `${base}/program` },
  ].filter(Boolean);

  return `
    <div class="flex flex-col gap-8">
      ${alerts.length ? `
        <div class="${cx.list}">
          ${alerts.map((a) => {
            const inner = `<span class="h-2 w-2 shrink-0 rounded-full ${a.dot}" aria-hidden="true"></span><span class="flex-1 text-body">${a.text}</span>${a.href || a.action ? `<span class="text-subtle">${icon('chevronRight', 'h-4 w-4')}</span>` : ''}`;
            if (a.href) return `<a href="${a.href}" class="${cx.rowCompact}">${inner}</a>`;
            if (a.action) return `<button type="button" data-action="${a.action}" class="${cx.rowCompact} w-full text-left">${inner}</button>`;
            return `<div class="flex min-h-14 items-center gap-3 px-4 py-3">${inner}</div>`;
          }).join('')}
        </div>` : ''}

      <div class="${cx.list}">
        ${infoRow('Последно тегло', latest ? `${formatNumber(latest.weight)} кг` : '—')}
        ${infoRow('Промяна', change !== null ? formatDelta(change) : '—')}
        ${infoRow('Последен check-in', latest ? relativeDays(latest.createdAt) : '—', latest ? { href: `${base}/checkins` } : {})}
        ${infoRow('Следващ check-in', `${next.weekday} · ${inDays(next.days).toLowerCase()}`)}
        ${c.goal ? infoRow('Цел', escapeHtml(c.goal)) : ''}
      </div>

      <div class="flex flex-col gap-2">
        <button type="button" data-action="share" class="${cx.btnSecondary}">${icon('link', 'h-4 w-4')} Линк за клиента</button>
        <button type="button" data-action="delete-client" class="${cx.btnGhostDanger}">Изтрий клиента</button>
      </div>
    </div>`;
}

function tabCheckins() {
  if (!state.checkins.length) {
    return emptyState({ iconName: 'inbox', title: 'Още няма check-ins', text: 'Изпрати линка на клиента.', action: `<button type="button" data-action="share" class="${cx.btnPrimary}">${icon('share', 'h-4 w-4')} Изпрати линка</button>` });
  }
  return `<div class="flex flex-col gap-2">${state.checkins.map((ck, i) => {
    const prev = state.checkins[i + 1];
    const waiting = !String(ck.coachNote ?? '').trim();
    return `
      <details class="group rounded-md border border-line bg-surface" ${i === 0 && waiting ? 'open' : ''} data-checkin="${escapeHtml(ck.id)}">
        <summary class="tap flex min-h-18 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          ${waiting ? '<span class="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Чака отговор"></span>' : ''}
          ${checkinSummary(ck, prev)}
          <span class="text-subtle transition group-open:rotate-90">${icon('chevronRight', 'h-4 w-4')}</span>
        </summary>
        <div class="flex flex-col gap-4 border-t border-line p-4">
          ${checkinBody(ck, prev)}
          <form data-reply class="flex flex-col gap-2 border-t border-line pt-4">
            <label class="${cx.field}">
              <span class="${cx.fieldLabel}">Отговор към клиента</span>
              <textarea name="note" rows="3" placeholder="Обратна връзка за седмицата" class="${cx.input} resize-none">${escapeHtml(ck.coachNote ?? '')}</textarea>
            </label>
            <div class="flex items-center justify-between gap-3">
              <span data-reply-status class="text-caption text-subtle">${ck.coachNoteAt ? `Изпратено ${formatDateTime(ck.coachNoteAt)}` : ''}</span>
              <button type="submit" class="${cx.btnPrimarySm}">${waiting ? 'Изпрати' : 'Обнови'}</button>
            </div>
          </form>
        </div>
      </details>`;
  }).join('')}</div>`;
}

function tabProgress() {
  if (state.checkins.length < 1) return emptyState({ iconName: 'chart', title: 'Още няма данни', text: 'Прогресът се появява след първия check-in.' });
  const photos = photoTimeline(state.checkins);
  return `
    <div class="flex flex-col gap-8">
      ${weightChart(state.checkins) || `<div class="${cx.card} text-small text-muted">Графиката се появява след втория check-in.</div>`}
      <section>
        ${sectionTitle('Снимки')}
        ${photos ? `<div class="flex flex-col gap-6">${photos}</div>` : '<p class="text-small text-subtle">Още няма снимки.</p>'}
      </section>
    </div>`;
}

function tabProgram() {
  const p = normalizeProgram(state.client.program);
  return `
    <form id="program-form" class="flex flex-col gap-8" novalidate>
      <section>
        ${sectionTitle('Тренировки')}
        <div class="${cx.list}">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => `
            <label class="flex min-h-14 items-center gap-3 px-4">
              <span class="w-1/3 shrink-0 text-body text-muted">${WEEKDAYS[d]}</span>
              <input name="w${d}" value="${escapeHtml(p.workouts[d])}" placeholder="Почивка" maxlength="40" class="${cx.input} min-h-14" />
            </label>`).join('')}
        </div>
      </section>
      <section class="flex flex-col gap-2">
        ${sectionTitle('Хранене и стъпки')}
        <label class="${cx.field}">
          <span class="${cx.fieldLabel}">Хранителен план</span>
          <textarea name="nutrition" rows="3" placeholder="Напр. 1 900 kcal · 130 г протеин" class="${cx.input} resize-none">${escapeHtml(p.nutrition)}</textarea>
        </label>
        <label class="${cx.field}">
          <span class="${cx.fieldLabel}">Стъпки на ден</span>
          <input name="steps" inputmode="numeric" value="${p.steps ?? ''}" placeholder="8000" class="${cx.input} tabular-nums" />
        </label>
      </section>
      <section>
        ${sectionTitle('Ден за check-in')}
        <div class="grid grid-cols-7 gap-1 rounded-md bg-surface p-1" role="radiogroup" aria-label="Ден за check-in">
          ${[1, 2, 3, 4, 5, 6, 0].map((d) => `
            <label class="tap cursor-pointer">
              <input type="radio" name="checkinDay" value="${d}" class="peer sr-only" ${p.checkinDay === d ? 'checked' : ''} />
              <span class="flex h-11 items-center justify-center rounded-sm text-small font-medium text-muted peer-checked:bg-raised peer-checked:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-accent">${WEEKDAYS_SHORT[d]}</span>
            </label>`).join('')}
        </div>
      </section>
      <button type="submit" class="${cx.btnPrimary}">Запази програмата</button>
    </form>`;
}

async function loadNotes() {
  const body = $('#tab-body');
  try {
    const notes = await state.backend.getClientNotes(state.client.id);
    body.innerHTML = `
      <form id="notes-form" class="flex flex-col gap-2">
        <label class="${cx.field}">
          <span class="${cx.fieldLabel}">Само за теб · клиентът не ги вижда</span>
          <textarea name="text" rows="10" placeholder="Контузии, предпочитания, договорки" class="${cx.input} resize-y">${escapeHtml(notes.text)}</textarea>
        </label>
        <div class="flex items-center justify-between gap-3">
          <span data-notes-status class="text-caption text-subtle">${notes.updatedAt ? `Запазено ${formatDateTime(notes.updatedAt)}` : ''}</span>
          <button type="submit" class="${cx.btnPrimarySm}">Запази</button>
        </div>
      </form>`;
  } catch (err) {
    handleError(err);
  }
}

/* =========================================================================
   Съобщения
   ========================================================================= */

async function renderMessages() {
  view.innerHTML = `${pageTitle('Съобщения')}${skeletonList(3)}`;
  let checkins;
  try {
    checkins = await state.backend.listCoachCheckins();
  } catch (err) {
    handleError(err);
    return;
  }
  const names = Object.fromEntries(state.clients.map((c) => [c.id, c.name]));
  const known = checkins.filter((c) => names[c.clientId]);
  const waiting = known.filter((c) => !String(c.coachNote ?? '').trim());
  const answered = known.filter((c) => String(c.coachNote ?? '').trim()).slice(0, 10);

  const row = (c) => `
    <a href="#/client/${encodeURIComponent(c.clientId)}/checkins" class="${cx.row}">
      ${avatar(names[c.clientId])}
      <span class="min-w-0 flex-1">
        <span class="flex items-baseline justify-between gap-2"><span class="truncate text-body font-medium">${escapeHtml(names[c.clientId])}</span><span class="shrink-0 text-caption text-subtle">${relativeDays(c.createdAt)}</span></span>
        <span class="block truncate text-small text-muted">${escapeHtml(c.comment || `${weekLabel(c.createdAt)} · ${formatNumber(c.weight)} кг`)}</span>
      </span>
    </a>`;

  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      ${pageTitle('Съобщения')}
      ${!known.length ? emptyState({ iconName: 'message', title: 'Няма съобщения', text: 'Тук се появяват check-ins от клиентите, на които да отговориш.' }) : ''}
      ${waiting.length ? `<section>${sectionTitle('Чакат отговор')}<div class="${cx.list}">${waiting.map(row).join('')}</div></section>` : ''}
      ${answered.length ? `<section>${sectionTitle('Отговорени')}<div class="${cx.list}">${answered.map(row).join('')}</div></section>` : ''}
    </div>`;
}

/* =========================================================================
   Профил
   ========================================================================= */

function renderProfile() {
  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      ${pageTitle('Профил')}
      <section class="flex items-center gap-4">
        ${avatar(state.user.name, 'h-14 w-14 text-title')}
        <div class="min-w-0">
          <p class="truncate text-title font-semibold">${escapeHtml(state.user.name)}</p>
          <p class="truncate text-small text-muted">${escapeHtml(state.user.email)} · Треньор</p>
        </div>
      </section>
      <div class="${cx.list}">
        ${infoRow('Клиенти', state.clients.length)}
        ${state.backend.kind === 'local' ? infoRow('Данни', 'Само в този браузър', { tone: 'text-warning' }) : ''}
      </div>
      <button type="button" data-action="logout" class="${cx.btnSecondary}">${icon('logout', 'h-4 w-4')} Изход</button>
    </div>`;
}

/* =========================================================================
   Add client sheet
   ========================================================================= */

function mountSheets() {
  $('#sheets').innerHTML = sheetHtml('client-modal', 'client-modal-title', `
    <section id="client-step-form">
      <h2 id="client-modal-title" class="pr-12 text-title font-semibold">Нов клиент</h2>
      <form id="client-form" class="mt-6 flex flex-col gap-2" novalidate>
        <label class="${cx.field}"><span class="${cx.fieldLabel}">Име</span><input id="client-name" name="name" autocomplete="off" placeholder="Мария Петрова" class="${cx.input}" required /></label>
        <label class="${cx.field}"><span class="${cx.fieldLabel}">Имейл · по избор</span><input name="email" type="email" inputmode="email" autocomplete="off" placeholder="name@email.com" class="${cx.input}" /></label>
        <label class="${cx.field}"><span class="${cx.fieldLabel}">Цел · по избор</span><input name="goal" autocomplete="off" maxlength="140" placeholder="−5 кг за 12 седмици" class="${cx.input}" /></label>
        <p id="client-error" class="${cx.error} hidden" role="alert"></p>
        <button id="client-submit" type="submit" class="${cx.btnPrimary} mt-4">Добави</button>
      </form>
    </section>
    <section id="client-step-link" class="hidden">
      <h2 class="pr-12 text-title font-semibold">Изпрати линка</h2>
      <p class="mt-1 text-small text-muted">С него <span id="created-client-name" class="text-fg"></span> създава акаунт или изпраща check-in.</p>
      <p id="created-link" class="mt-6 truncate rounded-md border border-line bg-canvas px-4 py-3 text-small text-muted"></p>
      <p id="local-link-warning" class="mt-2 hidden text-caption text-warning">Демо режим: линкът работи само в този браузър.</p>
      <div class="mt-6 flex flex-col gap-2">
        <button id="share-created" type="button" class="${cx.btnPrimary}">${icon('share', 'h-4 w-4')} Сподели</button>
        <button id="open-created" type="button" class="${cx.btnSecondary}">Към профила</button>
      </div>
    </section>`);
  if (state.backend.kind === 'local') $('#local-link-warning').classList.remove('hidden');

  $('#client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = $('#client-submit');
    const fd = new FormData(e.currentTarget);
    $('#client-error').classList.add('hidden');
    setLoading(button, true);
    try {
      const client = await state.backend.createClient({ name: fd.get('name'), email: fd.get('email'), goal: fd.get('goal') });
      state.lastCreated = client;
      state.clients.push(client);
      $('#created-client-name').textContent = firstName(client.name);
      $('#created-link').textContent = inviteUrl(client.token);
      $('#client-step-form').classList.add('hidden');
      $('#client-step-link').classList.remove('hidden');
      route();
    } catch (err) {
      $('#client-error').textContent = errorMessage(err);
      $('#client-error').classList.remove('hidden');
    } finally {
      setLoading(button, false);
    }
  });
  $('#share-created').addEventListener('click', () => state.lastCreated && share(state.lastCreated));
  $('#open-created').addEventListener('click', () => {
    closeModal('client-modal');
    if (state.lastCreated) window.location.hash = `#/client/${encodeURIComponent(state.lastCreated.id)}`;
  });
}

function openAddClient() {
  $('#client-form').reset();
  $('#client-error').classList.add('hidden');
  $('#client-step-form').classList.remove('hidden');
  $('#client-step-link').classList.add('hidden');
  openModal('client-modal');
}

/* =========================================================================
   Events
   ========================================================================= */

function bindEvents() {
  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-nav-action="add"]')) return openAddClient();

    const photo = e.target.closest('[data-photo]');
    if (photo) return openLightbox(photo.dataset.photo, photo.dataset.caption);

    const filter = e.target.closest('[data-filter]');
    if (filter) {
      window.location.hash = filter.dataset.filter === 'all' ? '#/clients' : `#/clients/${filter.dataset.filter}`;
      return;
    }

    const tab = e.target.closest('[data-client-tab]');
    if (tab) {
      window.location.hash = `${state.base}/${tab.dataset.clientTab}`;
      return;
    }

    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'add-client') openAddClient();
    else if (action === 'share' && state.client) share(state.client);
    else if (action === 'delete-client') deleteClient();
    else if (action === 'logout') {
      await state.backend.logout();
      window.location.replace('index.html');
    }
  });

  view.addEventListener('input', debounce((e) => {
    if (e.target.id === 'client-search') {
      state.search = e.target.value;
      renderClientList();
    }
  }, 80));

  view.addEventListener('submit', async (e) => {
    const form = e.target;
    e.preventDefault();
    const button = form.querySelector('[type=submit]');

    if (form.matches('[data-reply]')) {
      const card = form.closest('[data-checkin]');
      setLoading(button, true);
      try {
        const saved = await state.backend.updateCoachNote(card.dataset.checkin, new FormData(form).get('note'));
        const local = state.checkins.find((c) => c.id === card.dataset.checkin);
        Object.assign(local, saved);
        state.client.awaitingReply = !String(state.checkins[0]?.coachNote ?? '').trim();
        const listed = state.clients.find((c) => c.id === state.client.id);
        if (listed) listed.awaitingReply = state.client.awaitingReply;
        form.querySelector('[data-reply-status]').textContent = saved.coachNote ? `Изпратено ${formatDateTime(saved.coachNoteAt)}` : '';
        button.dataset.label = saved.coachNote ? 'Обнови' : 'Изпрати';
        card.querySelector('summary [aria-label="Чака отговор"]')?.remove();
        renderNav('clients');
        toast(saved.coachNote ? 'Отговорът е изпратен' : 'Отговорът е изтрит');
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(button, false);
      }
    } else if (form.id === 'program-form') {
      const fd = new FormData(form);
      const program = {
        workouts: [0, 1, 2, 3, 4, 5, 6].map((d) => fd.get(`w${d}`)),
        nutrition: fd.get('nutrition'),
        steps: String(fd.get('steps') ?? '').replace(/\s/g, ''),
        checkinDay: Number(fd.get('checkinDay')),
      };
      setLoading(button, true);
      try {
        state.client.program = await state.backend.updateProgram(state.client.id, program);
        const listed = state.clients.find((c) => c.id === state.client.id);
        if (listed) listed.program = state.client.program;
        toast('Програмата е запазена');
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(button, false);
      }
    } else if (form.id === 'notes-form') {
      setLoading(button, true);
      try {
        const saved = await state.backend.saveClientNotes(state.client.id, new FormData(form).get('text'));
        form.querySelector('[data-notes-status]').textContent = `Запазено ${formatDateTime(saved.updatedAt)}`;
        toast('Бележките са запазени');
      } catch (err) {
        handleError(err);
      } finally {
        setLoading(button, false);
      }
    }
  });
}

async function deleteClient() {
  const c = state.client;
  const ok = await confirmDialog({
    title: `Изтриване на ${c.name}?`,
    message: 'Изтриват се клиентът, всички check-ins, снимки и бележки. Линкът спира да работи.',
    confirmText: 'Изтрий',
    danger: true,
  });
  if (!ok) return;
  try {
    await state.backend.deleteClient(c.id);
    state.clients = state.clients.filter((x) => x.id !== c.id);
    state.client = null;
    toast('Клиентът е изтрит');
    window.location.hash = '#/clients';
  } catch (err) {
    handleError(err);
  }
}

/* =========================================================================
   Router
   ========================================================================= */

async function route() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page, a, b] = parts;

  if (page === 'client' && a) {
    renderNav('clients');
    await renderClient(decodeURIComponent(a), TABS.some((t) => t.key === b) ? b : 'overview');
    return;
  }

  // Leaving a profile: next visit reloads fresh data.
  state.client = null;
  window.scrollTo({ top: 0 });
  if (page === 'clients') {
    renderNav('clients');
    renderClients(FILTERS.some((f) => f.key === a) ? a : 'all');
  } else if (page === 'messages') {
    renderNav('messages');
    await renderMessages();
  } else if (page === 'profile') {
    renderNav('profile');
    renderProfile();
  } else {
    renderNav('home');
    renderHome();
  }
}

async function main() {
  hydrateIcons();
  initModals();
  try {
    state.backend = await getBackend();
    state.user = await requireRole(state.backend, 'coach');
    if (!state.user) return;
    mountSheets();
    bindEvents();
    await loadClients();
    let lastPage = null;
    window.addEventListener('hashchange', async () => {
      const page = window.location.hash.split('/')[1] ?? '';
      // Refresh list data when switching top-level tabs (new check-ins, replies).
      if (page !== 'client' && page !== lastPage) await loadClients().catch(handleError);
      lastPage = page;
      route();
    });
    route();
  } catch (err) {
    handleError(err);
  }
}

main();
