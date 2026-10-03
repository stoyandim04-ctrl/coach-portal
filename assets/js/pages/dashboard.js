/**
 * Section 1 — Coach Dashboard (dashboard.html). Built to DESIGN.md (strict tokens).
 *
 * Hash routes:  #/            → overview + client list
 *               #/client/:id  → client profile & weekly history
 */
import { getBackend, checkinUrl } from '../services/backend.js';
import {
  $, escapeHtml, initials, errorMessage, formatNumber, formatDelta, formatDate, formatDateTime,
  relativeDays, isoWeek, daysSince, copyToClipboard,
} from '../lib/utils.js';
import { checkinStatus, STATUS, MEASUREMENTS, PHOTO_SLOTS, average } from '../lib/model.js';
import { icon, hydrateIcons, initModals, openModal, closeModal, setLoading, toast, openLightbox, confirmDialog } from '../lib/ui.js';

const app = $('#app');

const state = {
  backend: null,
  coach: null,
  clients: [],
  filter: 'all',
  search: '',
  client: null,
  checkins: [],
  lastCreated: null,
};

/* =========================================================================
   Shared fragments (DESIGN.md §7)
   ========================================================================= */

const CARD = 'rounded-lg bg-surface ring-1 ring-line';
const BTN_PRIMARY = 'inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 text-small font-semibold text-accent-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
const BTN_SECONDARY = 'inline-flex h-12 items-center justify-center gap-2 rounded-md bg-raised px-4 text-small font-medium text-fg ring-1 ring-line hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const BTN_ICON = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function avatar(client, size = 'h-10 w-10 text-small') {
  return `<span class="flex ${size} shrink-0 items-center justify-center rounded-full bg-raised font-display font-semibold text-fg ring-1 ring-line">${escapeHtml(initials(client.name))}</span>`;
}

function deltaClass(delta) {
  if (delta === null || Math.abs(delta) < 0.05) return 'text-muted';
  return delta < 0 ? 'text-success' : 'text-info';
}

function statusBadge(status) {
  return `<span class="inline-flex h-8 items-center gap-2 rounded-full px-3 text-caption font-medium ring-1 ${status.badge}">
    <span class="h-2 w-2 rounded-full ${status.dot}"></span>${status.label}</span>`;
}

function sectionHeader(title, meta = '') {
  return `<div class="flex items-baseline justify-between gap-4">
    <h2 class="font-display text-title font-semibold">${title}</h2>
    ${meta ? `<span class="text-caption text-subtle">${meta}</span>` : ''}
  </div>`;
}

function handleError(err) {
  if (err?.code === 'auth/required') {
    window.location.replace('index.html#login');
    return;
  }
  toast(errorMessage(err), 'error');
}

async function shareLink(client) {
  const url = checkinUrl(client.token);
  const data = { title: 'FitCheck — седмичен чек-ин', text: `Здравей, ${client.name}! Това е твоят линк за седмичен чек-ин:`, url };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  if (await copyToClipboard(url)) toast('Линкът е копиран');
}

async function copyLink(client) {
  if (await copyToClipboard(checkinUrl(client.token))) toast('Линкът е копиран в клипборда');
  else toast('Неуспешно копиране', 'error');
}

function setFabVisible(visible) {
  $('#fab-add').classList.toggle('hidden', !visible);
  $('#fab-add').classList.toggle('flex', visible);
}

/* =========================================================================
   Overview + client list
   ========================================================================= */

const FILTERS = [
  { key: 'all', label: 'Всички' },
  { key: 'ok', label: STATUS.ok.label },
  { key: 'due', label: STATUS.due.label },
  { key: 'late', label: STATUS.late.label },
  { key: 'none', label: STATUS.none.label },
];

function todayLabel() {
  const s = new Intl.DateTimeFormat('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function kpi(label, value, foot = '', valueClass = 'text-fg') {
  return `
    <div class="${CARD} flex flex-col gap-1 p-4 sm:p-6">
      <p class="truncate text-caption font-medium text-subtle">${label}</p>
      <p class="font-display text-headline font-semibold tabular-nums sm:text-display ${valueClass}">${value}</p>
      ${foot}
    </div>`;
}

function renderListView() {
  const firstName = state.coach.name.split(' ')[0] || 'треньор';
  const statuses = state.clients.map((c) => checkinStatus(c.lastCheckinAt).key);
  const total = state.clients.length;
  const fresh = statuses.filter((s) => s === 'ok').length;
  const attention = statuses.filter((s) => s === 'due' || s === 'late').length;
  const rate = total ? Math.round((fresh / total) * 100) : 0;

  app.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      <header class="flex items-end justify-between gap-4">
        <div>
          <p class="text-caption font-medium text-subtle">${todayLabel()}</p>
          <h1 class="mt-1 font-display text-headline font-semibold">Здравей, ${escapeHtml(firstName)}</h1>
        </div>
        <button data-action="add-client" class="${BTN_PRIMARY} hidden sm:inline-flex">${icon('plus', 'h-5 w-5')} Добави нов клиент</button>
      </header>

      <section class="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Обобщение">
        ${kpi('Клиенти', total)}
        ${kpi('Тази седмица', fresh, `
          <div class="mt-2 h-1 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow="${rate}" aria-valuemin="0" aria-valuemax="100" aria-label="Дял клиенти с чек-ин">
            <div class="h-full rounded-full bg-accent" style="width:${rate}%"></div>
          </div>`)}
        ${kpi('Внимание', attention, '', attention ? 'text-danger' : 'text-fg')}
      </section>

      <section class="flex flex-col gap-4">
        ${sectionHeader('Клиенти', total ? `${rate}% с чек-ин тази седмица` : '')}
        ${total ? `
          <label class="relative block">
            <span class="sr-only">Търси клиент</span>
            <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-subtle">${icon('search', 'h-4 w-4')}</span>
            <input id="client-search" type="search" value="${escapeHtml(state.search)}" placeholder="Търси клиент…" autocomplete="off"
              class="h-12 w-full rounded-md bg-surface pl-12 pr-4 text-body text-fg placeholder-subtle ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent" />
          </label>
          <div id="filter-chips" class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="toolbar" aria-label="Филтър по статус"></div>
          <div id="client-list" class="flex flex-col gap-2"></div>
        ` : emptyClientsHtml()}
      </section>
    </div>`;

  renderClientList();
  setFabVisible(true);
}

function emptyClientsHtml() {
  return `
    <div class="flex flex-col items-center rounded-lg px-6 py-12 text-center ring-1 ring-line">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">${icon('users')}</span>
      <h3 class="mt-4 font-display text-title font-semibold">Все още нямаш клиенти</h3>
      <p class="mt-1 max-w-xs text-small text-muted">Добави първия си клиент и му изпрати личния линк за седмичен чек-ин.</p>
      <button data-action="add-client" class="${BTN_PRIMARY} mt-6">${icon('plus', 'h-5 w-5')} Добави нов клиент</button>
    </div>`;
}

function renderClientList() {
  const list = $('#client-list');
  if (!list) return;

  const term = state.search.trim().toLowerCase();
  const all = state.clients
    .map((c) => ({ ...c, status: checkinStatus(c.lastCheckinAt) }))
    .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.email ?? '').includes(term))
    // Newest check-ins first; clients without one at the end (newest added first)
    .sort((a, b) => (b.lastCheckinAt ?? -1) - (a.lastCheckinAt ?? -1) || b.createdAt - a.createdAt);

  const count = (key) => (key === 'all' ? all.length : all.filter((c) => c.status.key === key).length);
  $('#filter-chips').innerHTML = FILTERS.map((f) => {
    const active = state.filter === f.key;
    return `<button data-filter="${f.key}" aria-pressed="${active}" class="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
      ${active ? 'bg-fg text-canvas' : 'bg-surface text-muted ring-1 ring-line hover:text-fg'}">
      ${f.key !== 'all' ? `<span class="h-2 w-2 rounded-full ${STATUS[f.key].dot}"></span>` : ''}${f.label}
      <span class="tabular-nums text-subtle">${count(f.key)}</span></button>`;
  }).join('');

  const visible = state.filter === 'all' ? all : all.filter((c) => c.status.key === state.filter);
  if (!visible.length) {
    list.innerHTML = `<p class="rounded-lg px-4 py-12 text-center text-small text-subtle ring-1 ring-line">Няма клиенти по този критерий.</p>`;
    return;
  }

  list.innerHTML = visible.map((c) => {
    const delta = c.checkinCount > 1 ? c.lastWeight - c.firstWeight : null;
    return `
      <a href="#/client/${encodeURIComponent(c.id)}" class="${CARD} group flex items-center gap-3 p-4 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span class="relative">
          ${avatar(c)}
          <span class="absolute -bottom-px -right-px h-3 w-3 rounded-full ring-2 ring-surface ${c.status.dot}" title="${c.status.label}"></span>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-body font-medium">${escapeHtml(c.name)}</span>
          <span class="flex items-center gap-1 truncate text-caption text-subtle">
            <span class="${c.status.text}">${c.lastCheckinAt ? `Чек-ин ${relativeDays(c.lastCheckinAt)}` : 'Няма чек-ин'}</span>
            ${c.goal ? `<span aria-hidden="true">·</span><span class="truncate">${escapeHtml(c.goal)}</span>` : ''}
          </span>
        </span>
        <span class="text-right">
          ${c.lastWeight != null
            ? `<span class="block font-display text-body font-semibold tabular-nums">${formatNumber(c.lastWeight)}<span class="ml-1 font-sans text-caption font-normal text-subtle">кг</span></span>`
            : '<span class="block text-body text-subtle">—</span>'}
          <span class="block text-caption tabular-nums ${deltaClass(delta)}">${delta !== null ? formatDelta(delta) : `${c.checkinCount} отчета`}</span>
        </span>
        <span class="hidden text-subtle group-hover:text-muted sm:block">${icon('chevronRight', 'h-5 w-5')}</span>
      </a>`;
  }).join('');
}

/* =========================================================================
   Client profile & history
   ========================================================================= */

function renderClientSkeleton() {
  app.innerHTML = `
    <div class="flex flex-col gap-8">
      <div class="skeleton h-10 w-1/3 rounded-md"></div>
      <div class="skeleton h-chart rounded-xl"></div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${'<div class="skeleton h-16 rounded-lg"></div>'.repeat(4)}</div>
      <div class="skeleton h-chart rounded-lg"></div>
    </div>`;
}

function stat(label, valueHtml, iconName) {
  return `
    <div class="${CARD} flex flex-col gap-2 p-4">
      <p class="flex items-center gap-1 text-caption font-medium text-subtle">${icon(iconName, 'h-4 w-4')}<span class="truncate">${label}</span></p>
      <p class="font-display text-title font-semibold tabular-nums">${valueHtml}</p>
    </div>`;
}

const unit = (u) => `<span class="ml-1 font-sans text-caption font-normal text-subtle">${u}</span>`;

function renderClientView() {
  const { client, checkins } = state;
  const status = checkinStatus(client.lastCheckinAt);
  const latest = checkins[0];
  const first = checkins[checkins.length - 1];
  const totalDelta = checkins.length > 1 ? latest.weight - first.weight : null;
  const recent = checkins.slice(0, 4);
  const avgSleep = average(recent.map((c) => c.sleep));
  const avgEnergy = average(recent.map((c) => c.energy));

  app.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8">
      <div class="flex flex-col gap-4">
        <a href="#/" class="-ml-2 inline-flex h-10 items-center gap-2 self-start rounded-md px-2 text-small font-medium text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">${icon('arrowLeft', 'h-4 w-4')} Всички клиенти</a>

        <section class="rounded-xl bg-surface p-4 ring-1 ring-line sm:p-6">
          <div class="flex items-start gap-4">
            ${avatar(client, 'h-14 w-14 text-title')}
            <div class="min-w-0 flex-1">
              <h1 class="truncate font-display text-title font-semibold sm:text-headline">${escapeHtml(client.name)}</h1>
              ${client.goal ? `<p class="truncate text-small text-muted">${escapeHtml(client.goal)}</p>` : ''}
              <div class="mt-2 flex flex-wrap items-center gap-2">
                ${statusBadge(status)}
                <span class="text-caption text-subtle">${client.lastCheckinAt ? `Последен ${relativeDays(client.lastCheckinAt)}` : 'Очаква първи чек-ин'}</span>
              </div>
            </div>
            <button data-action="delete-client" class="${BTN_ICON} hover:text-danger" aria-label="Изтрий клиента" title="Изтрий клиента">${icon('trash')}</button>
          </div>

          <div class="mt-6 grid grid-cols-3 gap-2">
            <button data-action="copy-link" class="${BTN_SECONDARY} px-2">${icon('copy', 'h-4 w-4')}<span>Линк</span></button>
            <button data-action="share-link" class="${BTN_SECONDARY} px-2">${icon('share', 'h-4 w-4')}<span>Сподели</span></button>
            <a href="${escapeHtml(checkinUrl(client.token))}" target="_blank" rel="noopener" class="${BTN_PRIMARY} px-2">${icon('send', 'h-4 w-4')}<span>Форма</span></a>
          </div>
          <p class="mt-4 truncate text-caption text-subtle">${client.email ? `${escapeHtml(client.email)} · ` : ''}Клиент от ${formatDate(client.createdAt)}</p>
        </section>
      </div>

      <section class="flex flex-col gap-2 sm:gap-4" aria-label="Показатели">
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          ${stat('Текущо тегло', latest ? `${formatNumber(latest.weight)}${unit('кг')}` : '—', 'scale')}
          ${stat('Обща промяна', totalDelta !== null ? `<span class="${deltaClass(totalDelta)}">${formatDelta(totalDelta)}</span>` : '—', totalDelta !== null && totalDelta > 0 ? 'trendUp' : 'trendDown')}
          ${stat('Сън · 4 седм.', avgSleep !== null ? `${formatNumber(avgSleep)}${unit('/10')}` : '—', 'moon')}
          ${stat('Енергия · 4 седм.', avgEnergy !== null ? `${formatNumber(avgEnergy)}${unit('/10')}` : '—', 'zap')}
        </div>
        ${checkins.length >= 2 ? weightChart(checkins) : ''}
      </section>

      <section class="flex flex-col gap-4">
        ${sectionHeader('История по седмици', `${checkins.length} ${checkins.length === 1 ? 'отчет' : 'отчета'}`)}
        ${checkins.length ? checkins.map((c, i) => checkinCard(c, checkins[i + 1])).join('') : emptyHistoryHtml()}
      </section>
    </div>`;
}

function emptyHistoryHtml() {
  return `
    <div class="flex flex-col items-center rounded-lg px-6 py-12 text-center ring-1 ring-line">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-raised text-muted">${icon('inbox')}</span>
      <h3 class="mt-4 font-display text-title font-semibold">Все още няма отчети</h3>
      <p class="mt-1 max-w-xs text-small text-muted">Изпрати линка на клиента — отчетите ще се появят тук автоматично.</p>
      <button data-action="share-link" class="${BTN_PRIMARY} mt-6">${icon('share', 'h-4 w-4')} Изпрати линка</button>
    </div>`;
}

/** Line chart: SVG path stretched to the box; dots and labels are HTML so text never distorts. */
function weightChart(checkinsDesc) {
  const points = [...checkinsDesc].reverse();
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;

  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * 100,
    y: 100 - ((p.weight - lo) / (hi - lo)) * 100,
    p,
  }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const area = `${line} L100,100 L0,100 Z`;
  const fmtShort = (ts) => formatDate(ts, { day: 'numeric', month: 'short' });

  return `
    <div class="${CARD} p-4 sm:p-6">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="font-display text-body font-semibold">Тегло</h3>
        <span class="text-caption tabular-nums text-subtle">${formatNumber(min)} – ${formatNumber(max)} кг</span>
      </div>
      <div class="relative mt-6 h-chart">
        <div class="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          ${'<div class="border-t border-dashed border-line"></div>'.repeat(4)}
        </div>
        <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#C8F31D" stop-opacity=".22" />
              <stop offset="1" stop-color="#C8F31D" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="${area}" fill="url(#wfill)" />
          <path d="${line}" fill="none" stroke="#C8F31D" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        ${coords.map((c, i) => {
          const last = i === coords.length - 1;
          return `<span class="group absolute -translate-x-1/2 -translate-y-1/2" style="left:${c.x}%;top:${c.y}%">
            <span class="block rounded-full ${last ? 'h-3 w-3 bg-accent ring-4 ring-accent/20' : 'h-2 w-2 bg-surface ring-2 ring-accent'}"></span>
            <span class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-fg px-2 text-caption font-medium text-canvas ${last ? '' : 'hidden group-hover:block'}">${formatNumber(c.p.weight)} кг</span>
          </span>`;
        }).join('')}
      </div>
      <div class="mt-4 flex justify-between text-caption text-subtle">
        <span>${fmtShort(points[0].createdAt)}</span>
        <span>${fmtShort(points[points.length - 1].createdAt)}</span>
      </div>
      <p class="sr-only">Тегло от ${formatNumber(points[0].weight)} до ${formatNumber(points[points.length - 1].weight)} кг за ${points.length} отчета.</p>
    </div>`;
}

function scoreBar(label, value, iconName) {
  const color = value >= 7 ? 'bg-success' : value >= 5 ? 'bg-warning' : 'bg-danger';
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between text-caption">
        <span class="flex items-center gap-1 font-medium text-subtle">${icon(iconName, 'h-4 w-4')} ${label}</span>
        <span class="font-display text-small font-semibold tabular-nums text-fg">${value}<span class="text-subtle">/10</span></span>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-raised"><div class="h-full rounded-full ${color}" style="width:${value * 10}%"></div></div>
    </div>`;
}

function checkinCard(c, prev) {
  const { week, year } = isoWeek(c.createdAt);
  const delta = prev ? c.weight - prev.weight : null;
  const measurements = MEASUREMENTS.filter((m) => c.measurements?.[m.key] != null);
  const hasPhotos = PHOTO_SLOTS.some((s) => c.photos?.[s.key]);
  const isNew = daysSince(c.createdAt) <= 1;
  const noteId = `note-${escapeHtml(c.id)}`;

  return `
    <article class="${CARD} overflow-hidden" data-checkin="${escapeHtml(c.id)}">
      <header class="flex items-center justify-between gap-4 border-b border-line p-4 sm:px-6">
        <div class="min-w-0">
          <p class="flex items-center gap-2">
            <span class="whitespace-nowrap font-display text-body font-semibold">Седмица ${week}</span>
            <span class="text-caption text-subtle">${year}</span>
            ${isNew ? '<span class="rounded-sm bg-accent px-2 text-caption font-semibold text-accent-fg">Нов</span>' : ''}
          </p>
          <p class="text-caption text-subtle">${formatDateTime(c.createdAt)}</p>
        </div>
        <div class="text-right">
          <p class="font-display text-title font-semibold tabular-nums">${formatNumber(c.weight)}${unit('кг')}</p>
          <p class="text-caption tabular-nums ${delta !== null ? deltaClass(delta) : 'text-subtle'}">${delta !== null ? formatDelta(delta) : 'начално'}</p>
        </div>
      </header>

      <div class="flex flex-col gap-6 p-4 sm:p-6">
        <div class="grid grid-cols-2 gap-4">
          ${scoreBar('Сън', c.sleep, 'moon')}
          ${scoreBar('Енергия', c.energy, 'zap')}
        </div>

        ${measurements.length ? `
          <div class="flex flex-col gap-2">
            <p class="flex items-center gap-1 text-caption font-medium text-subtle">${icon('ruler', 'h-4 w-4')} Мерки, см</p>
            <div class="flex flex-wrap gap-2">
              ${measurements.map((m) => {
                const pv = prev?.measurements?.[m.key];
                const d = pv != null ? c.measurements[m.key] - pv : null;
                return `<span class="inline-flex h-8 items-center gap-1 rounded-sm bg-raised px-3 text-small ring-1 ring-line">
                  <span class="text-muted">${m.label}</span>
                  <span class="font-medium tabular-nums">${formatNumber(c.measurements[m.key])}</span>
                  ${d !== null && Math.abs(d) >= 0.05 ? `<span class="text-caption tabular-nums ${deltaClass(d)}">${formatDelta(d, '').trim()}</span>` : ''}
                </span>`;
              }).join('')}
            </div>
          </div>` : ''}

        ${hasPhotos ? `
          <div class="grid grid-cols-3 gap-2">
            ${PHOTO_SLOTS.map((s) => c.photos?.[s.key]
              ? `<button data-action="photo" data-src="${escapeHtml(c.photos[s.key])}" data-caption="${escapeHtml(`${s.label} · Седмица ${week}`)}"
                  class="photo-slot group relative overflow-hidden rounded-md bg-raised ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Снимка ${s.label}">
                  <img src="${escapeHtml(c.photos[s.key])}" alt="" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  <span class="absolute bottom-2 left-2 rounded-sm bg-black/70 px-2 text-caption font-medium text-fg">${s.label}</span>
                </button>`
              : `<div class="photo-slot flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-subtle">${icon('image', 'h-5 w-5')}<span class="text-caption">${s.label}</span></div>`).join('')}
          </div>` : ''}

        ${c.comment ? `
          <div class="rounded-md bg-raised p-4">
            <p class="flex items-center gap-1 text-caption font-medium text-subtle">${icon('message', 'h-4 w-4')} ${escapeHtml(c.clientName || 'Клиентът')} пише</p>
            <p class="mt-2 whitespace-pre-line text-small text-fg">${escapeHtml(c.comment)}</p>
          </div>` : ''}

        <div class="flex flex-col gap-2">
          <label for="${noteId}" class="flex items-center gap-1 text-caption font-medium text-muted">${icon('edit', 'h-4 w-4')} Бележка на треньора</label>
          <textarea id="${noteId}" rows="2" data-note placeholder="Обратна връзка, корекции в плана…"
            class="w-full resize-y rounded-md bg-raised px-4 py-3 text-body text-fg placeholder-subtle ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-accent">${escapeHtml(c.coachNote ?? '')}</textarea>
          <div class="flex items-center justify-end gap-3">
            <span data-note-status class="text-caption text-subtle">${c.coachNoteAt ? `Запазено ${formatDateTime(c.coachNoteAt)}` : ''}</span>
            <button data-action="save-note" class="${BTN_SECONDARY} h-10">${icon('check', 'h-4 w-4')} Запази</button>
          </div>
        </div>
      </div>
    </article>`;
}

/* =========================================================================
   Routing
   ========================================================================= */

async function loadClients() {
  state.clients = await state.backend.listClients();
}

async function route() {
  const match = window.location.hash.match(/^#\/client\/([^/?#]+)/);
  window.scrollTo({ top: 0 });

  if (!match) {
    state.client = null;
    document.title = 'Табло · FitCheck';
    renderListView();
    return;
  }

  setFabVisible(false);
  renderClientSkeleton();
  try {
    const clientId = decodeURIComponent(match[1]);
    const [client, checkins] = await Promise.all([state.backend.getClient(clientId), state.backend.listCheckins(clientId)]);
    state.client = client;
    state.checkins = checkins;
    document.title = `${client.name} · FitCheck`;
    renderClientView();
  } catch (err) {
    handleError(err);
    window.location.hash = '#/';
  }
}

/* =========================================================================
   Add client flow
   ========================================================================= */

function openAddClient() {
  $('#client-form').reset();
  $('#client-error').classList.add('hidden');
  $('#client-step-form').classList.remove('hidden');
  $('#client-step-link').classList.add('hidden');
  openModal('client-modal');
}

async function onCreateClient(e) {
  e.preventDefault();
  const button = $('#client-submit');
  const form = new FormData(e.currentTarget);
  $('#client-error').classList.add('hidden');
  setLoading(button, true, 'Създаване…');
  try {
    const client = await state.backend.createClient({ name: form.get('name'), email: form.get('email'), goal: form.get('goal') });
    state.lastCreated = client;
    state.clients.push(client);

    $('#created-client-name').textContent = client.name;
    $('#created-link').textContent = checkinUrl(client.token);
    $('#client-step-form').classList.add('hidden');
    $('#client-step-link').classList.remove('hidden');
    if (!state.client) renderListView();
  } catch (err) {
    const el = $('#client-error');
    el.textContent = errorMessage(err);
    el.classList.remove('hidden');
  } finally {
    setLoading(button, false);
  }
}

/* =========================================================================
   Events
   ========================================================================= */

function bindEvents() {
  $('#logout-btn').addEventListener('click', async () => {
    await state.backend.logout();
    window.location.href = 'index.html';
  });

  $('#fab-add').addEventListener('click', openAddClient);
  $('#client-form').addEventListener('submit', onCreateClient);
  $('#copy-created-link').addEventListener('click', () => state.lastCreated && copyLink(state.lastCreated));
  $('#share-created-link').addEventListener('click', () => state.lastCreated && shareLink(state.lastCreated));
  $('#open-created-client').addEventListener('click', () => {
    closeModal('client-modal');
    if (state.lastCreated) window.location.hash = `#/client/${encodeURIComponent(state.lastCreated.id)}`;
  });

  app.addEventListener('input', (e) => {
    if (e.target.id === 'client-search') {
      state.search = e.target.value;
      renderClientList();
    }
  });

  app.addEventListener('click', async (e) => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      state.filter = filter.dataset.filter;
      renderClientList();
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'add-client') openAddClient();
    else if (action === 'copy-link') copyLink(state.client);
    else if (action === 'share-link') shareLink(state.client);
    else if (action === 'photo') openLightbox(actionEl.dataset.src, actionEl.dataset.caption);
    else if (action === 'save-note') await saveNote(actionEl);
    else if (action === 'delete-client') await deleteClient();
  });
}

async function saveNote(button) {
  const card = button.closest('[data-checkin]');
  const textarea = card.querySelector('[data-note]');
  setLoading(button, true);
  try {
    const saved = await state.backend.updateCoachNote(card.dataset.checkin, textarea.value);
    const local = state.checkins.find((c) => c.id === card.dataset.checkin);
    if (local) Object.assign(local, { coachNote: saved.coachNote, coachNoteAt: saved.coachNoteAt });
    card.querySelector('[data-note-status]').textContent = `Запазено ${formatDateTime(saved.coachNoteAt)}`;
    toast('Бележката е запазена');
  } catch (err) {
    handleError(err);
  } finally {
    setLoading(button, false);
  }
}

async function deleteClient() {
  const client = state.client;
  const ok = await confirmDialog({
    title: `Изтриване на ${client.name}?`,
    message: 'Ще бъдат изтрити клиентът, всички негови отчети и снимки. Линкът му спира да работи. Действието е необратимо.',
    confirmText: 'Изтрий',
    danger: true,
  });
  if (!ok) return;
  try {
    await state.backend.deleteClient(client.id);
    state.clients = state.clients.filter((c) => c.id !== client.id);
    toast(`${client.name} е изтрит(а)`);
    window.location.hash = '#/';
  } catch (err) {
    handleError(err);
  }
}

/* =========================================================================
   Boot
   ========================================================================= */

async function main() {
  hydrateIcons();
  initModals();

  try {
    state.backend = await getBackend();
    state.coach = await state.backend.getCurrentCoach();
    if (!state.coach) {
      window.location.replace('index.html#login');
      return;
    }

    const avatarEl = $('#coach-avatar');
    avatarEl.textContent = initials(state.coach.name);
    avatarEl.title = state.coach.name;
    avatarEl.classList.replace('hidden', 'inline-flex');
    if (state.backend.kind === 'local') {
      $('#backend-badge').classList.replace('hidden', 'inline-flex');
      $('#local-link-warning').classList.remove('hidden');
    }

    bindEvents();
    await loadClients();
    window.addEventListener('hashchange', async () => {
      // Refresh aggregates when returning to the list (new check-ins, deletions)
      if (!window.location.hash.startsWith('#/client/')) await loadClients().catch(handleError);
      route();
    });
    route();
  } catch (err) {
    handleError(err);
  }
}

main();
