/**
 * Section 2 — Client check-in form (checkin.html?t=<token>). Public, no login.
 * Built to DESIGN.md: strict tokens, hairline borders, premium fields.
 */
import { getBackend } from '../services/backend.js';
import { $, $$, errorMessage, compressImage, isoWeek, formatNumber } from '../lib/utils.js';
import { MEASUREMENTS, PHOTO_SLOTS } from '../lib/model.js';
import { icon, hydrateIcons, setLoading, toast } from '../lib/ui.js';

const token = new URLSearchParams(window.location.search).get('t');
const photos = {}; // slot → { dataUrl, blob }
const touched = new Set(); // sliders the client actually moved
let backend;
let submitting = false;

/* Premium field (DESIGN.md §7). Error state is toggled via `data-invalid`. */
const FIELD = 'rounded-lg border border-white/10 bg-surface transition duration-200 hover:border-white/20 focus-within:border-accent/60 focus-within:bg-raised focus-within:ring-4 focus-within:ring-accent/10';
const INVALID = ['border-danger/60', 'ring-4', 'ring-danger/10'];

const VIEWS = ['view-loading', 'view-invalid', 'checkin-form', 'view-success'];
function show(viewId) {
  for (const id of VIEWS) {
    const el = $(`#${id}`);
    const visible = id === viewId;
    el.classList.toggle('hidden', !visible);
    if (id === 'view-invalid' || id === 'view-success') el.classList.toggle('flex', visible);
  }
  const formVisible = viewId === 'checkin-form';
  $('#progress').classList.toggle('hidden', !formVisible);
  $('#progress').classList.toggle('flex', formVisible);
  window.scrollTo({ top: 0 });
}

/* ---------- Completion meter (5 sections) ---------- */

const SECTIONS = [
  () => $('#weight').value.trim() !== '',
  () => touched.size > 0,
  () => $$('#measurements input').some((i) => i.value.trim() !== ''),
  () => Object.keys(photos).length > 0,
  () => $('#comment').value.trim() !== '',
];

function renderProgress() {
  const done = SECTIONS.map((check) => check());
  const bar = $('#progress');
  bar.innerHTML = done.map((d) => `<span class="h-1 flex-1 rounded-full transition duration-200 ${d ? 'bg-accent' : 'bg-white/10'}"></span>`).join('');
  bar.setAttribute('aria-valuenow', String(done.filter(Boolean).length));
}

/* ---------- Field errors ---------- */

function setFieldError(name, message) {
  const field = $(`[data-field="${name}"]`);
  const text = $(`[data-error-for="${name}"]`);
  if (field) INVALID.forEach((c) => field.classList.toggle(c, Boolean(message)));
  if (text) {
    text.textContent = message ?? '';
    text.classList.toggle('hidden', !message);
  }
}

function clearErrors() {
  ['weight', 'clientName', 'measurements'].forEach((n) => setFieldError(n, null));
  $$('#measurements [data-field]').forEach((f) => INVALID.forEach((c) => f.classList.remove(c)));
  $('#form-error').classList.add('hidden');
}

const ERROR_TARGET = { 'validation/weight': 'weight', 'validation/name': 'clientName', 'validation/measurement': 'measurements' };

/* ---------- Weight ---------- */

function parseDecimal(value) {
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function bindWeight() {
  const input = $('#weight');
  // Accept digits and one decimal separator only.
  input.addEventListener('input', () => {
    const cleaned = input.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
    if (cleaned !== input.value) input.value = cleaned;
    setFieldError('weight', null);
    renderProgress();
  });
  input.addEventListener('blur', () => {
    const n = parseDecimal(input.value);
    if (input.value && n !== null) input.value = formatNumber(n, 1);
  });
  $$('[data-step]').forEach((btn) => btn.addEventListener('click', () => {
    const current = parseDecimal(input.value);
    if (current === null || input.value === '') {
      input.focus();
      return;
    }
    const next = Math.max(0, Math.round((current + Number(btn.dataset.step)) * 10) / 10);
    input.value = formatNumber(next, 1);
    renderProgress();
  }));
}

/* ---------- Scores ---------- */

const SCORE_WORDS = ['', 'Много слабо', 'Слабо', 'Слабо', 'Под средното', 'Средно', 'Средно', 'Добре', 'Много добре', 'Отлично', 'Отлично'];

function bindScore(container) {
  const input = $('input', container);
  const update = () => {
    const v = Number(input.value);
    $('[data-score-value]', container).textContent = v;
    $('[data-score-label]', container).textContent = SCORE_WORDS[v];
    input.style.setProperty('--fill', `${((v - 1) / 9) * 100}%`);
  };
  input.addEventListener('input', () => {
    touched.add(input.name);
    update();
    renderProgress();
  });
  update();
}

/* ---------- Measurements ---------- */

function renderMeasurements() {
  // Waist is the key fat-loss marker, so it gets the full row.
  $('#measurements').innerHTML = MEASUREMENTS.map((m, i) => `
    <label data-field="m_${m.key}" class="${FIELD} flex cursor-text flex-col gap-1 px-4 py-3 ${i === 0 ? 'col-span-2' : ''}">
      <span class="flex items-baseline justify-between gap-2">
        <span class="text-caption font-medium text-muted">${m.label}</span>
        <span class="text-caption text-subtle">см</span>
      </span>
      <input name="m_${m.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="—"
        class="w-full bg-transparent font-display text-title font-semibold tabular-nums text-fg placeholder-white/20 focus:outline-none" />
      <span class="text-caption text-subtle">${m.hint}</span>
    </label>`).join('');

  $$('#measurements input').forEach((input) => input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d.,]/g, '');
    INVALID.forEach((c) => input.closest('[data-field]').classList.remove(c));
    setFieldError('measurements', null);
    renderProgress();
  }));
  $$('#measurements input').forEach((input) => input.addEventListener('blur', () => {
    const n = parseDecimal(input.value);
    if (input.value && n !== null) input.value = formatNumber(n, 1);
  }));
}

/* ---------- Photos ---------- */

function renderPhotoSlots() {
  $('#photo-slots').innerHTML = PHOTO_SLOTS.map((s) => `
    <div class="photo-slot relative" data-slot="${s.key}">
      <label class="group flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-white/10 bg-surface text-muted transition duration-200 hover:border-white/20 hover:text-fg focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
        <input type="file" accept="image/*" class="sr-only" data-photo-input="${s.key}" aria-label="Снимка ${s.label}" />
        <span data-empty class="flex flex-col items-center gap-2">
          <span class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition duration-200 group-hover:border-white/20">${icon('camera', 'h-4 w-4')}</span>
          <span class="flex flex-col items-center">
            <span class="text-small font-medium text-fg">${s.label}</span>
            <span class="text-caption uppercase tracking-wider text-subtle">${s.hint}</span>
          </span>
        </span>
        <img data-preview alt="${s.label}" class="absolute inset-0 hidden h-full w-full object-cover" />
        <span data-busy class="absolute inset-0 hidden items-center justify-center bg-black/70 text-accent"><span class="spinner"></span></span>
      </label>
      <span data-badge class="pointer-events-none absolute bottom-2 left-2 hidden items-center gap-1 rounded-sm bg-black/70 px-2 text-caption font-medium text-fg">${icon('check', 'h-4 w-4 text-accent')}${s.label}</span>
      <button type="button" data-remove="${s.key}" class="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/70 text-fg backdrop-blur transition duration-150 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Премахни снимка ${s.label}">${icon('x', 'h-4 w-4')}</button>
    </div>`).join('');

  $$('[data-photo-input]').forEach((input) => input.addEventListener('change', onPhotoSelected));
  $$('[data-remove]').forEach((btn) => btn.addEventListener('click', () => setPhoto(btn.dataset.remove, null)));
}

function setPhoto(slot, photo) {
  const el = $(`[data-slot="${slot}"]`);
  const has = Boolean(photo);
  if (has) photos[slot] = photo;
  else delete photos[slot];

  const img = $('[data-preview]', el);
  img.classList.toggle('hidden', !has);
  if (has) img.src = photo.dataUrl;
  else img.removeAttribute('src');
  $('[data-empty]', el).classList.toggle('hidden', has);
  for (const sel of ['[data-badge]', '[data-remove]']) {
    $(sel, el).classList.toggle('hidden', !has);
    $(sel, el).classList.toggle('flex', has);
  }
  const label = $('label', el);
  label.classList.toggle('border-dashed', !has);
  label.classList.toggle('border-solid', has);
  if (!has) $('[data-photo-input]', el).value = '';
  renderProgress();
}

async function onPhotoSelected(e) {
  const input = e.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  const slot = input.dataset.photoInput;
  const busy = $(`[data-slot="${slot}"] [data-busy]`);
  busy.classList.replace('hidden', 'flex');
  try {
    setPhoto(slot, await compressImage(file, backend.photoOptions));
  } catch (err) {
    toast(errorMessage(err), 'error');
    input.value = '';
  } finally {
    busy.classList.replace('flex', 'hidden');
  }
}

/* ---------- Submit ---------- */

function collect(form) {
  const fd = new FormData(form);
  const measurements = {};
  for (const m of MEASUREMENTS) measurements[m.key] = fd.get(`m_${m.key}`);
  return {
    clientName: fd.get('clientName'),
    weight: fd.get('weight'),
    sleep: fd.get('sleep'),
    energy: fd.get('energy'),
    measurements,
    comment: fd.get('comment'),
    photos: { ...photos },
  };
}

function showError(err) {
  const target = ERROR_TARGET[err?.code];
  if (target) {
    setFieldError(target, errorMessage(err));
    if (target === 'measurements') {
      // Highlight the measurement named in the message.
      const m = MEASUREMENTS.find((x) => err.message.includes(x.label));
      if (m) INVALID.forEach((c) => $(`[data-field="m_${m.key}"]`).classList.add(c));
    }
    const focusEl = target === 'measurements' ? $('#measurements') : $(`#${target}`);
    focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target !== 'measurements') setTimeout(() => focusEl.focus({ preventScroll: true }), 300);
    return;
  }
  const el = $('#form-error');
  el.textContent = errorMessage(err);
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function onSubmit(e, context) {
  e.preventDefault();
  if (submitting) return;
  submitting = true;
  clearErrors();

  const button = $('#submit-btn');
  setLoading(button, true, Object.keys(photos).length ? 'Качване на снимките…' : 'Изпращане…');
  try {
    const checkin = await backend.submitCheckin(token, collect(e.currentTarget));
    renderSuccess(checkin, context);
  } catch (err) {
    showError(err);
  } finally {
    submitting = false;
    setLoading(button, false);
  }
}

function renderSuccess(checkin, context) {
  $('#success-name').textContent = checkin.clientName.split(' ')[0];
  $('#success-coach').textContent = context.coachName
    ? `${context.coachName} ще прегледа отчета ти скоро.`
    : 'Треньорът ти ще прегледа отчета скоро.';

  const tile = (label, value, unit) => `
    <div class="flex flex-col gap-1 rounded-lg border border-white/10 p-4 text-left">
      <span class="text-caption font-medium text-subtle">${label}</span>
      <span class="font-display text-title font-semibold tabular-nums">${value}<span class="ml-1 font-sans text-caption font-normal text-subtle">${unit}</span></span>
    </div>`;
  $('#success-summary').innerHTML = [
    tile('Тегло', formatNumber(checkin.weight), 'кг'),
    tile('Сън', checkin.sleep, '/10'),
    tile('Енергия', checkin.energy, '/10'),
  ].join('');
  show('view-success');
}

/* ---------- Boot ---------- */

async function main() {
  hydrateIcons();
  try {
    backend = await getBackend();
    const context = token ? await backend.getCheckinContext(token) : null;
    if (!context) {
      if (backend.kind === 'local') $('#invalid-local-hint').classList.remove('hidden');
      show('view-invalid');
      return;
    }

    const { week, year } = isoWeek(Date.now());
    const chip = $('#week-chip');
    chip.textContent = `Седмица ${week} · ${year}`;
    chip.classList.replace('hidden', 'inline-flex');
    if (context.coachName) {
      $('#coach-name').textContent = context.coachName;
      $('#eyebrow').textContent = `Седмичен отчет за ${context.coachName}`;
    }
    $('#hello-name').textContent = context.clientName.split(' ')[0];
    $('#clientName').value = context.clientName;
    $('#clientName').addEventListener('input', () => setFieldError('clientName', null));
    document.title = `Чек-ин · ${context.clientName} · FitCheck`;

    bindWeight();
    $$('[data-score]').forEach(bindScore);
    renderMeasurements();
    renderPhotoSlots();

    const comment = $('#comment');
    comment.addEventListener('input', () => {
      $('#comment-count').textContent = comment.value.length;
      renderProgress();
    });

    $('#checkin-form').addEventListener('submit', (e) => onSubmit(e, context));
    renderProgress();
    show('checkin-form');
  } catch (err) {
    console.error(err);
    $('#invalid-title').textContent = 'Нещо се обърка';
    $('#invalid-text').textContent = `${errorMessage(err)} Опитайте да презаредите страницата.`;
    show('view-invalid');
  }
}

main();
