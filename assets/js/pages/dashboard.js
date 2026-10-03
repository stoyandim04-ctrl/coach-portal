/**
 * Coach dashboard (dashboard.html).
 * Hash routes:  #/            → client list
 *               #/client/:id  → client history
 */
import { getBackend, checkinUrl } from '../services/backend.js';
import {
  $, $$, escapeHtml, initials, errorMessage, formatNumber, formatDelta, formatDate, formatDateTime,
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
   Helpers
   ========================================================================= */

const AVATAR_COLORS = [
  'bg-pink-500/15 text-pink-300', 'bg-sky-500/15 text-sky-300', 'bg-emerald-500/15 text-emerald-300',
  'bg-amber-500/15 text-amber-300', 'bg-violet-500/15 text-violet-300', 'bg-rose-500/15 text-rose-300',
  'bg-teal-500/15 text-teal-300', 'bg-orange-500/15 text-orange-300',
];

function avatarColor(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function avatar(client, size = 'h-12 w-12 text-sm') {
  return `<span class="flex ${size} shrink-0 items-center justify-center rounded-full font-bold ${avatarColor(client.id)}">${escapeHtml(initials(client.name))}</span>`;
}

function deltaClass(delta) {
  if (delta === null || Math.abs(delta) < 0.05) return 'text-zinc-400';
  return delta < 0 ? 'text-emerald-400' : 'text-sky-400';
}

function statusBadge(status, extra = '') {
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.badge} ${extra}">
    <span class="h-1.5 w-1.5 rounded-full ${status.dot}"></span>${status.label}</span>`;
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

/* =========================================================================
   Client list view
   ========================================================================= */

const FILTERS = [
  { key: 'all', label: 'Всички' },
  { key: 'ok', label: STATUS.ok.label },
  { key: 'due', label: STATUS.due.label },
  { key: 'late', label: STATUS.late.label },
  { key: 'none', label: STATUS.none.label },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Добро утро';
  if (h < 18) return 'Добър ден';
  return 'Добър вечер';
}

function renderListView() {
  const firstName = state.coach.name.split(' ')[0] || 'треньор';
  const withStatus = state.clients.map((c) => ({ ...c, status: checkinStatus(c.lastCheckinAt) }));
  const thisWeek = withStatus.filter((c) => c.status.key === 'ok').length;
  const attention = withStatus.filter((c) => c.status.key === 'due' || c.status.key === 'late').length;

  app.innerHTML = `
    <section class="animate-fade-in">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-sm text-zinc-500">${greeting()},</p>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">${escapeHtml(firstName)} 👋</h1>
        </div>
        <button data-action="add-client" class="hidden h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink-950 shadow-glow hover:bg-brand-400 sm:inline-flex">
          ${icon('plus', 'h-4 w-4')} Добави нов клиент
        </button>
      </div>

      <div class="mt-6 grid grid-cols-3 gap-2.5 sm:gap-4">
        ${statTile('Клиенти', state.clients.length, 'users', 'text-white')}
        ${statTile('Тази седмица', thisWeek, 'check', 'text-brand')}
        ${statTile('Внимание', attention, 'alert', attention ? 'text-rose-400' : 'text-white')}
      </div>

      ${state.clients.length ? `
        <div class="mt-6 space-y-3">
          <label class="relative block">
            <span class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-zinc-500">${icon('search', 'h-4 w-4')}</span>
            <input id="client-search" type="search" value="${escapeHtml(state.search)}" placeholder="Търси клиент…" autocomplete="off"
              class="h-12 w-full rounded-2xl bg-ink-850 pl-11 pr-4 text-white placeholder-zinc-500 ring-1 ring-white/5 focus:outline-none focus:ring-2 focus:ring-brand" />
          </label>
          <div id="filter-chips" class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0"></div>
        </div>
        <div id="client-list" class="mt-4 space-y-2.5"></div>
      ` : emptyClientsHtml()}
    </section>`;

  renderClientList();
  $('#fab-add').classList.remove('hidden');
  $('#fab-add').classList.add('flex');
}

function statTile(label, value, iconName, valueClass) {
  return `
    <div class="rounded-2xl bg-ink-850 p-3.5 ring-1 ring-white/5 sm:p-5">
      <div class="flex items-center justify-between text-zinc-500">${icon(iconName, 'h-4 w-4')}</div>
      <p class="mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${valueClass}">${value}</p>
      <p class="mt-0.5 truncate text-[11px] font-medium text-zinc-500 sm:text-xs">${label}</p>
    </div>`;
}

function emptyClientsHtml() {
  return `
    <div class="mt-10 rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">${icon('users', 'h-7 w-7')}</div>
      <h2 class="mt-5 text-lg font-semibold">Все още нямаш клиенти</h2>
      <p class="mx-auto mt-1.5 max-w-xs text-sm text-zinc-400">Добави първия си клиент и му изпрати личния линк за седмичен чек-ин.</p>
      <button data-action="add-client" class="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-semibold text-ink-950 hover:bg-brand-400">
        ${icon('plus', 'h-5 w-5')} Добави нов клиент
      </button>
    </div>`;
}

function renderClientList() {
  const list = $('#client-list');
  if (!list) return;

  const term = state.search.trim().toLowerCase();
  const all = state.clients
    .map((c) => ({ ...c, status: checkinStatus(c.lastCheckinAt) }))
    .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.email ?? '').includes(term))
    // Newest check-ins first; clients without a check-in at the end (newest added first)
    .sort((a, b) => (b.lastCheckinAt ?? -1) - (a.lastCheckinAt ?? -1) || b.createdAt - a.createdAt);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, f.key === 'all' ? all.length : all.filter((c) => c.status.key === f.key).length]));
  $('#filter-chips').innerHTML = FILTERS.map((f) => {
    const active = state.filter === f.key;
    return `<button data-filter="${f.key}" class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 transition
      ${active ? 'bg-white text-ink-950 ring-white' : 'bg-ink-850 text-zinc-400 ring-white/5 hover:text-white'}">
      ${f.key !== 'all' ? `<span class="h-1.5 w-1.5 rounded-full ${STATUS[f.key].dot}"></span>` : ''}${f.label}
      <span class="${active ? 'text-ink-950/60' : 'text-zinc-600'}">${counts[f.key]}</span></button>`;
  }).join('');

  const visible = state.filter === 'all' ? all : all.filter((c) => c.status.key === state.filter);
  if (!visible.length) {
    list.innerHTML = `<p class="rounded-2xl bg-ink-850/60 px-4 py-10 text-center text-sm text-zinc-500">Няма клиенти по този критерий.</p>`;
    return;
  }

  list.innerHTML = visible.map((c) => {
    const delta = c.checkinCount > 1 ? c.lastWeight - c.firstWeight : null;
    return `
      <a href="#/client/${encodeURIComponent(c.id)}" class="group flex items-center gap-3.5 rounded-2xl bg-ink-850 p-3.5 ring-1 ring-white/5 transition hover:bg-ink-800 hover:ring-white/10 active:scale-[.99] sm:p-4">
        <div class="relative">
          ${avatar(c)}
          <span class="${c.status.key === 'ok' ? 'dot-pulse' : ''} absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-850 ${c.status.dot}" title="${c.status.label}"></span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">${escapeHtml(c.name)}</p>
          <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs text-zinc-500">
            <span class="${c.status.text}">${c.lastCheckinAt ? `Чек-ин ${relativeDays(c.lastCheckinAt)}` : 'Няма чек-ин'}</span>
            ${c.goal ? `<span class="text-zinc-700">·</span><span class="truncate">${escapeHtml(c.goal)}</span>` : ''}
          </p>
        </div>
        <div class="text-right">
          <p class="font-semibold tabular-nums">${c.lastWeight != null ? `${formatNumber(c.lastWeight)} <span class="text-xs font-normal text-zinc-500">кг</span>` : '<span class="text-zinc-600">—</span>'}</p>
          <p class="text-xs tabular-nums ${deltaClass(delta)}">${delta !== null ? formatDelta(delta) : `${c.checkinCount} чек-ина`}</p>
        </div>
        <span class="hidden text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400 sm:block">${icon('chevronRight', 'h-5 w-5')}</span>
      </a>`;
  }).join('');
}

/* =========================================================================
   Client detail view
   ========================================================================= */

function renderClientSkeleton() {
  app.innerHTML = `
    <div class="space-y-4">
      <div class="skeleton h-5 w-32 rounded"></div>
      <div class="skeleton h-40 rounded-3xl"></div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">${'<div class="skeleton h-24 rounded-2xl"></div>'.repeat(4)}</div>
      <div class="skeleton h-56 rounded-3xl"></div>
    </div>`;
}

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
    <section class="animate-fade-in">
      <a href="#/" class="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-400 hover:text-white">${icon('arrowLeft', 'h-4 w-4')} Всички клиенти</a>

      <div class="mt-4 rounded-3xl bg-ink-850 p-5 ring-1 ring-white/5 sm:p-6">
        <div class="flex items-start gap-4">
          ${avatar(client, 'h-16 w-16 text-xl')}
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-xl font-bold tracking-tight sm:text-2xl">${escapeHtml(client.name)}</h1>
            ${client.goal ? `<p class="mt-0.5 text-sm text-zinc-400">🎯 ${escapeHtml(client.goal)}</p>` : ''}
            <div class="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              ${statusBadge(status)}
              <span>${client.lastCheckinAt ? `Последен: ${relativeDays(client.lastCheckinAt)}` : 'Очаква първи чек-ин'}</span>
            </div>
          </div>
          <button data-action="delete-client" class="rounded-xl p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Изтрий клиента" title="Изтрий клиента">${icon('trash', 'h-5 w-5')}</button>
        </div>

        <div class="mt-5 grid grid-cols-3 gap-2">
          <button data-action="copy-link" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10">${icon('copy', 'h-4 w-4')}<span>Линк</span></button>
          <button data-action="share-link" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10">${icon('share', 'h-4 w-4')}<span>Сподели</span></button>
          <a href="${escapeHtml(checkinUrl(client.token))}" target="_blank" rel="noopener" class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-ink-950 hover:bg-brand-400">${icon('send', 'h-4 w-4')}<span>Форма</span></a>
        </div>
        ${client.email ? `<p class="mt-3 truncate text-xs text-zinc-500">${escapeHtml(client.email)} · клиент от ${formatDate(client.createdAt)}</p>` : `<p class="mt-3 text-xs text-zinc-500">Клиент от ${formatDate(client.createdAt)}</p>`}
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        ${miniStat('Текущо тегло', latest ? `${formatNumber(latest.weight)}<span class="ml-1 text-sm font-medium text-zinc-500">кг</span>` : '—', 'scale')}
        ${miniStat('Обща промяна', totalDelta !== null ? `<span class="${deltaClass(totalDelta)}">${formatDelta(totalDelta)}</span>` : '—', totalDelta !== null && totalDelta > 0 ? 'trendUp' : 'trendDown')}
        ${miniStat('Сън (ср. 4 седм.)', avgSleep !== null ? `${formatNumber(avgSleep)}<span class="ml-0.5 text-sm font-medium text-zinc-500">/10</span>` : '—', 'moon')}
        ${miniStat('Енергия (ср.)', avgEnergy !== null ? `${formatNumber(avgEnergy)}<span class="ml-0.5 text-sm font-medium text-zinc-500">/10</span>` : '—', 'zap')}
      </div>

      ${checkins.length >= 2 ? weightChart(checkins) : ''}

      <div class="mt-8 flex items-center justify-between">
        <h2 class="text-lg font-semibold">История по седмици</h2>
        <span class="text-sm text-zinc-500">${checkins.length} ${checkins.length === 1 ? 'отчет' : 'отчета'}</span>
      </div>

      <div class="mt-4 space-y-4">
        ${checkins.length ? checkins.map((c, i) => checkinCard(c, checkins[i + 1])).join('') : emptyHistoryHtml()}
      </div>
    </section>`;
}

function miniStat(label, valueHtml, iconName) {
  return `
    <div class="rounded-2xl bg-ink-850 p-4 ring-1 ring-white/5">
      <div class="flex items-center gap-1.5 text-xs font-medium text-zinc-500">${icon(iconName, 'h-3.5 w-3.5')}<span class="truncate">${label}</span></div>
      <p class="mt-2 text-xl font-bold tabular-nums">${valueHtml}</p>
    </div>`;
}

function emptyHistoryHtml() {
  return `
    <div class="rounded-3xl border border-dashed border-white/10 px-6 py-12 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-zinc-400">${icon('inbox', 'h-6 w-6')}</div>
      <p class="mt-4 font-semibold">Все още няма чек-ини</p>
      <p class="mx-auto mt-1 max-w-xs text-sm text-zinc-400">Изпрати линка на клиента — отчетите ще се появят тук автоматично.</p>
      <button data-action="share-link" class="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-ink-950 hover:bg-brand-400">${icon('share', 'h-4 w-4')} Изпрати линка</button>
    </div>`;
}

/** Responsive line chart: SVG path stretched to the box, HTML dots/labels so text never distorts. */
function weightChart(checkinsDesc) {
  const points = [...checkinsDesc].reverse();
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;

  const coords = points.map((p, i) => ({
    x: points.length === 1 ? 50 : (i / (points.length - 1)) * 100,
    y: 100 - ((p.weight - lo) / (hi - lo)) * 100,
    p,
  }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const area = `${line} L100,100 L0,100 Z`;

  return `
    <div class="mt-3 rounded-3xl bg-ink-850 p-5 ring-1 ring-white/5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">Тегло</h3>
        <span class="text-xs text-zinc-500">${formatNumber(min)} – ${formatNumber(max)} кг</span>
      </div>
      <div class="relative mt-5 h-40">
        <div class="absolute inset-0 flex flex-col justify-between">
          ${'<div class="border-t border-dashed border-white/5"></div>'.repeat(4)}
        </div>
        <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#C8F31D" stop-opacity=".28" />
              <stop offset="1" stop-color="#C8F31D" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="${area}" fill="url(#wfill)" />
          <path d="${line}" fill="none" stroke="#C8F31D" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        ${coords.map((c, i) => {
          const last = i === coords.length - 1;
          return `<span class="group absolute -translate-x-1/2 -translate-y-1/2" style="left:${c.x}%;top:${c.y}%">
            <span class="block rounded-full ${last ? 'h-3.5 w-3.5 bg-brand ring-4 ring-brand/25' : 'h-2 w-2 bg-ink-850 ring-2 ring-brand'}"></span>
            <span class="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-ink-950 ${last ? '' : 'hidden group-hover:block'}">${formatNumber(c.p.weight)} кг</span>
          </span>`;
        }).join('')}
      </div>
      <div class="mt-3 flex justify-between text-[11px] text-zinc-500">
        <span>${formatDate(points[0].createdAt, { day: 'numeric', month: 'short' })}</span>
        <span>${formatDate(points[points.length - 1].createdAt, { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>`;
}

function scoreBar(label, value, iconName) {
  const color = value >= 7 ? 'bg-emerald-400' : value >= 5 ? 'bg-amber-400' : 'bg-rose-500';
  return `
    <div>
      <div class="flex items-center justify-between text-xs">
        <span class="flex items-center gap-1.5 text-zinc-400">${icon(iconName, 'h-3.5 w-3.5')} ${label}</span>
        <span class="font-semibold tabular-nums">${value}/10</span>
      </div>
      <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5"><div class="h-full rounded-full ${color}" style="width:${value * 10}%"></div></div>
    </div>`;
}

function checkinCard(c, prev) {
  const { week, year } = isoWeek(c.createdAt);
  const delta = prev ? c.weight - prev.weight : null;
  const measurements = MEASUREMENTS.filter((m) => c.measurements?.[m.key] != null);
  const hasPhotos = PHOTO_SLOTS.some((s) => c.photos?.[s.key]);
  const isNew = daysSince(c.createdAt) <= 1;

  return `
    <article class="overflow-hidden rounded-3xl bg-ink-850 ring-1 ring-white/5" data-checkin="${escapeHtml(c.id)}">
      <header class="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div>
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold"><span class="whitespace-nowrap">Седмица ${week} <span class="text-xs font-normal text-zinc-500">· ${year}</span></span>
            ${isNew ? '<span class="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-ink-950">Нов</span>' : ''}</p>
          <p class="mt-0.5 text-xs text-zinc-500">${formatDateTime(c.createdAt)}</p>
        </div>
        <div class="text-right">
          <p class="text-xl font-bold tabular-nums">${formatNumber(c.weight)}<span class="ml-1 text-sm font-medium text-zinc-500">кг</span></p>
          ${delta !== null ? `<p class="text-xs font-medium tabular-nums ${deltaClass(delta)}">${formatDelta(delta)}</p>` : '<p class="text-xs text-zinc-500">начално</p>'}
        </div>
      </header>

      <div class="space-y-5 p-5">
        <div class="grid grid-cols-2 gap-4">
          ${scoreBar('Сън', c.sleep, 'moon')}
          ${scoreBar('Енергия', c.energy, 'zap')}
        </div>

        ${measurements.length ? `
          <div>
            <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-500">${icon('ruler', 'h-3.5 w-3.5')} Мерки (см)</p>
            <div class="flex flex-wrap gap-2">
              ${measurements.map((m) => {
                const pv = prev?.measurements?.[m.key];
                const d = pv != null ? c.measurements[m.key] - pv : null;
                return `<span class="rounded-xl bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/5">
                  <span class="text-zinc-400">${m.label}</span> <span class="font-semibold tabular-nums">${formatNumber(c.measurements[m.key])}</span>
                  ${d !== null && Math.abs(d) >= 0.05 ? `<span class="ml-0.5 text-xs ${deltaClass(d)}">${formatDelta(d, '')}</span>` : ''}
                </span>`;
              }).join('')}
            </div>
          </div>` : ''}

        ${hasPhotos ? `
          <div class="grid grid-cols-3 gap-2">
            ${PHOTO_SLOTS.map((s) => c.photos?.[s.key]
              ? `<button data-action="photo" data-src="${escapeHtml(c.photos[s.key])}" data-caption="${escapeHtml(`${s.label} · Седмица ${week}`)}"
                  class="photo-slot group relative overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/5">
                  <img src="${escapeHtml(c.photos[s.key])}" alt="${s.label}" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  <span class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-medium text-white/90">${s.label}</span>
                </button>`
              : `<div class="photo-slot flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-zinc-600">${icon('image', 'h-5 w-5')}<span class="mt-1 text-[11px]">${s.label}</span></div>`).join('')}
          </div>` : ''}

        ${c.comment ? `
          <div class="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/5">
            <p class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-500">${icon('message', 'h-3.5 w-3.5')} Коментар от ${escapeHtml(c.clientName || 'клиента')}</p>
            <p class="whitespace-pre-line text-sm leading-relaxed text-zinc-200">${escapeHtml(c.comment)}</p>
          </div>` : ''}

        <div>
          <label for="note-${escapeHtml(c.id)}" class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-brand">${icon('edit', 'h-3.5 w-3.5')} Бележка на треньора</label>
          <textarea id="note-${escapeHtml(c.id)}" rows="2" data-note placeholder="Обратна връзка, корекции в плана…"
            class="w-full resize-y rounded-2xl bg-ink-900 px-4 py-3 text-sm text-white placeholder-zinc-600 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand">${escapeHtml(c.coachNote ?? '')}</textarea>
          <div class="mt-2 flex items-center justify-end gap-3">
            <span data-note-status class="text-xs text-zinc-500">${c.coachNoteAt ? `Запазено ${formatDateTime(c.coachNoteAt)}` : ''}</span>
            <button data-action="save-note" class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/5 px-3.5 text-sm font-semibold ring-1 ring-white/10 hover:bg-white/10">${icon('check', 'h-4 w-4')} Запази</button>
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
    renderListView();
    return;
  }

  $('#fab-add').classList.add('hidden');
  $('#fab-add').classList.remove('flex');
  renderClientSkeleton();
  try {
    const clientId = decodeURIComponent(match[1]);
    const [client, checkins] = await Promise.all([state.backend.getClient(clientId), state.backend.listCheckins(clientId)]);
    state.client = client;
    state.checkins = checkins;
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
    message: 'Ще бъдат изтрити клиентът, всички негови чек-ини и снимки. Линкът му спира да работи. Действието е необратимо.',
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

    $('#coach-name').textContent = state.coach.name;
    $('#coach-avatar').textContent = initials(state.coach.name);
    $('#coach-chip').classList.add('sm:flex'); // stays hidden on phones
    if (state.backend.kind === 'local') {
      $('#backend-badge').classList.remove('hidden');
      $('#local-link-warning').classList.remove('hidden');
    }

    bindEvents();
    await loadClients();
    window.addEventListener('hashchange', async () => {
      // Refresh aggregates when coming back to the list (e.g. after notes / new check-ins)
      if (!window.location.hash.startsWith('#/client/')) await loadClients().catch(handleError);
      route();
    });
    route();
  } catch (err) {
    handleError(err);
  }
}

main();
