/**
 * Shared, data-driven view fragments used by both the coach and the client app.
 */
import { escapeHtml, formatNumber, formatDelta, formatDate, formatDateTime, relativeDays, isoWeek } from './utils.js';
import { checkinStatus, SCORES, MEASUREMENTS, PHOTO_SLOTS } from './model.js';
import { icon, avatar, statusDot, cx } from './ui.js';

/** One-line status for a client row: "Нов check-in · чака отговор", "Преди 9 дни", … */
export function clientStatusLine(client) {
  const status = checkinStatus(client.lastCheckinAt);
  if (client.awaitingReply) return { dot: 'bg-accent', text: `Нов check-in · ${relativeDays(client.lastCheckinAt)}`, tone: 'text-fg' };
  if (status.key === 'none') return { dot: status.dot, text: 'Без check-in', tone: 'text-subtle' };
  if (status.key === 'late') return { dot: status.dot, text: 'Пропуснат check-in', tone: 'text-muted' };
  const rel = relativeDays(client.lastCheckinAt);
  if (status.key === 'due') return { dot: status.dot, text: rel.charAt(0).toUpperCase() + rel.slice(1), tone: 'text-muted' };
  return { dot: status.dot, text: `Check-in ${rel}`, tone: 'text-muted' };
}

export function clientRow(client, href) {
  const line = clientStatusLine(client);
  return `
    <a href="${href}" class="${cx.row}">
      ${avatar(client.name)}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-body font-medium">${escapeHtml(client.name)}</span>
        <span class="flex items-center gap-2 text-small ${line.tone}">${statusDot({ dot: line.dot })}<span class="truncate">${line.text}</span></span>
      </span>
      ${client.lastWeight != null ? `<span class="shrink-0 text-small tabular-nums text-muted">${formatNumber(client.lastWeight)} кг</span>` : ''}
      <span class="shrink-0 text-subtle">${icon('chevronRight', 'h-4 w-4')}</span>
    </a>`;
}

/** Label/value row inside a `cx.list`. */
export function infoRow(label, value, { href = '', tone = 'text-fg' } = {}) {
  const inner = `
    <span class="flex-1 text-body text-muted">${label}</span>
    <span class="text-body tabular-nums ${tone}">${value}</span>
    ${href ? `<span class="text-subtle">${icon('chevronRight', 'h-4 w-4')}</span>` : ''}`;
  return href
    ? `<a href="${href}" class="tap flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-raised">${inner}</a>`
    : `<div class="flex min-h-14 items-center gap-3 px-4 py-3">${inner}</div>`;
}

/** Line chart drawn to scale. SVG path stretches; dots and labels are HTML so text never distorts. */
export function weightChart(checkinsDesc) {
  const points = [...checkinsDesc].reverse();
  if (points.length < 2) return '';
  const weights = points.map((p) => p.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;
  const coords = points.map((p, i) => ({ x: (i / (points.length - 1)) * 100, y: 100 - ((p.weight - lo) / (hi - lo)) * 100, p }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
  const last = coords[coords.length - 1];
  const fmtShort = (ts) => formatDate(ts, { day: 'numeric', month: 'short' });

  return `
    <div class="${cx.card}">
      <div class="flex items-baseline justify-between gap-4">
        <p class="text-small text-muted">Тегло</p>
        <p class="text-caption tabular-nums text-subtle">${formatNumber(min)}–${formatNumber(max)} кг</p>
      </div>
      <div class="relative mt-6 h-chart">
        <div class="absolute inset-0 flex flex-col justify-between" aria-hidden="true">${'<div class="border-t border-line"></div>'.repeat(3)}</div>
        <svg class="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="${line}" fill="none" stroke="#ECECEE" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        <span class="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg ring-4 ring-surface" style="left:${last.x}%;top:${last.y}%"></span>
        <span class="absolute -translate-x-full -translate-y-full whitespace-nowrap pb-2 text-caption font-medium tabular-nums text-fg" style="left:${last.x}%;top:${last.y}%">${formatNumber(last.p.weight)} кг</span>
      </div>
      <div class="mt-3 flex justify-between text-caption text-subtle">
        <span>${fmtShort(points[0].createdAt)}</span><span>${fmtShort(last.p.createdAt)}</span>
      </div>
      <p class="sr-only">Тегло от ${formatNumber(points[0].weight)} до ${formatNumber(last.p.weight)} кг за ${points.length} check-in-а.</p>
    </div>`;
}

export function weekLabel(ts) {
  const { week } = isoWeek(ts);
  return `Седмица ${week}`;
}

/** Summary line of a check-in (used as the collapsed header). */
export function checkinSummary(c, prev) {
  const delta = prev ? c.weight - prev.weight : null;
  return `
    <span class="min-w-0 flex-1">
      <span class="block text-body font-medium">${weekLabel(c.createdAt)}</span>
      <span class="block text-small text-muted">${formatDateTime(c.createdAt)}</span>
    </span>
    <span class="text-right">
      <span class="block text-body tabular-nums">${formatNumber(c.weight)} кг</span>
      <span class="block text-small tabular-nums text-subtle">${delta !== null ? formatDelta(delta) : 'първи'}</span>
    </span>`;
}

/** Full check-in body: scores, measurements, photos, comment. */
export function checkinBody(c, prev) {
  const scores = SCORES.filter((s) => c[s.key] != null);
  const measurements = MEASUREMENTS.filter((m) => c.measurements?.[m.key] != null);
  const hasPhotos = PHOTO_SLOTS.some((s) => c.photos?.[s.key]);

  return `
    <div class="flex flex-col gap-4">
      ${scores.length ? `
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
          ${scores.map((s) => `<div class="flex items-baseline justify-between gap-2"><dt class="truncate text-small text-muted">${s.short ?? s.label}</dt><dd class="text-small tabular-nums">${c[s.key]}/10</dd></div>`).join('')}
        </dl>` : ''}
      ${measurements.length ? `
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4">
          ${measurements.map((m) => {
            const pv = prev?.measurements?.[m.key];
            const d = pv != null ? c.measurements[m.key] - pv : null;
            return `<div class="flex items-baseline justify-between gap-2"><dt class="text-small text-muted">${m.label}</dt><dd class="text-small tabular-nums">${formatNumber(c.measurements[m.key])} см${d !== null && Math.abs(d) >= 0.05 ? ` <span class="text-subtle">${formatDelta(d, '').trim()}</span>` : ''}</dd></div>`;
          }).join('')}
        </dl>` : ''}
      ${hasPhotos ? `
        <div class="grid grid-cols-3 gap-2">
          ${PHOTO_SLOTS.map((s) => c.photos?.[s.key]
            ? `<button type="button" data-photo="${escapeHtml(c.photos[s.key])}" data-caption="${escapeHtml(`${s.label} · ${weekLabel(c.createdAt)}`)}" class="tap photo-slot overflow-hidden rounded-sm bg-raised" aria-label="Снимка ${s.label}"><img src="${escapeHtml(c.photos[s.key])}" alt="" loading="lazy" class="h-full w-full object-cover" /></button>`
            : `<div class="photo-slot flex items-center justify-center rounded-sm border border-line text-caption text-subtle">${s.label}</div>`).join('')}
        </div>` : ''}
      ${c.comment ? `<p class="whitespace-pre-line text-body text-fg">${escapeHtml(c.comment)}</p>` : ''}
    </div>`;
}

/** Progress photos grouped by week, newest first. */
export function photoTimeline(checkinsDesc) {
  const withPhotos = checkinsDesc.filter((c) => PHOTO_SLOTS.some((s) => c.photos?.[s.key]));
  if (!withPhotos.length) return '';
  return withPhotos.map((c) => `
    <div class="flex flex-col gap-2">
      <p class="text-small text-muted">${weekLabel(c.createdAt)} · ${formatDate(c.createdAt, { day: 'numeric', month: 'short' })}</p>
      <div class="grid grid-cols-3 gap-2">
        ${PHOTO_SLOTS.map((s) => c.photos?.[s.key]
          ? `<button type="button" data-photo="${escapeHtml(c.photos[s.key])}" data-caption="${escapeHtml(`${s.label} · ${weekLabel(c.createdAt)}`)}" class="tap photo-slot overflow-hidden rounded-sm bg-raised" aria-label="Снимка ${s.label}"><img src="${escapeHtml(c.photos[s.key])}" alt="" loading="lazy" class="h-full w-full object-cover" /></button>`
          : `<div class="photo-slot rounded-sm border border-line"></div>`).join('')}
      </div>
    </div>`).join('');
}
