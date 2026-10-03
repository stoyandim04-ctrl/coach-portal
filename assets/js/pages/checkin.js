/**
 * Public client check-in form (checkin.html?t=<token>). No login required.
 */
import { getBackend } from '../services/backend.js';
import { $, $$, errorMessage, compressImage, isoWeek, formatNumber } from '../lib/utils.js';
import { MEASUREMENTS, PHOTO_SLOTS } from '../lib/model.js';
import { icon, hydrateIcons, setLoading, toast } from '../lib/ui.js';

const token = new URLSearchParams(window.location.search).get('t');
const photos = {}; // slot → { dataUrl, blob }
let backend;
let submitting = false;

function show(viewId) {
  ['view-loading', 'view-invalid', 'checkin-form', 'view-success'].forEach((id) => {
    $(`#${id}`).classList.toggle('hidden', id !== viewId);
  });
  window.scrollTo({ top: 0 });
}

/* ---------- Score sliders ---------- */

function scoreLabel(v) {
  if (v <= 3) return 'Слабо';
  if (v <= 5) return 'Средно';
  if (v <= 8) return 'Добре';
  return 'Отлично';
}

function bindScore(container) {
  const input = $('input', container);
  const update = () => {
    const v = Number(input.value);
    $('[data-score-value]', container).textContent = v;
    $('[data-score-label]', container).textContent = scoreLabel(v);
    input.style.setProperty('--fill', `${((v - 1) / 9) * 100}%`);
  };
  input.addEventListener('input', update);
  update();
}

/* ---------- Measurements ---------- */

function renderMeasurements() {
  $('#measurements').innerHTML = MEASUREMENTS.map((m) => `
    <label class="block">
      <span class="mb-1.5 block text-xs font-medium text-zinc-400">${m.label}</span>
      <span class="relative block">
        <input name="m_${m.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="—"
          class="h-12 w-full rounded-xl bg-ink-900 px-4 pr-10 font-semibold tabular-nums text-white placeholder-zinc-700 ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-brand" />
        <span class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-zinc-500">см</span>
      </span>
    </label>`).join('');
}

/* ---------- Photos ---------- */

function renderPhotoSlots() {
  $('#photo-slots').innerHTML = PHOTO_SLOTS.map((s) => `
    <div class="photo-slot relative" data-slot="${s.key}">
      <label class="group flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/10 bg-ink-900 text-zinc-500 transition hover:border-brand/50 hover:text-brand focus-within:border-brand">
        <input type="file" accept="image/*" class="sr-only" data-photo-input="${s.key}" aria-label="Снимка ${s.label}" />
        <span data-empty class="flex flex-col items-center">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition group-hover:bg-brand/10">${icon('camera', 'h-5 w-5')}</span>
          <span class="mt-2 text-xs font-semibold text-zinc-300">${s.label}</span>
          <span class="text-[10px] uppercase tracking-wider text-zinc-600">${s.hint}</span>
        </span>
        <img data-preview alt="${s.label}" class="absolute inset-0 hidden h-full w-full object-cover" />
        <span data-busy class="absolute inset-0 hidden items-center justify-center bg-black/60 text-brand"><span class="spinner"></span></span>
      </label>
      <button type="button" data-remove="${s.key}" class="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/20 backdrop-blur" aria-label="Премахни снимката">${icon('x', 'h-4 w-4')}</button>
      <span data-badge class="pointer-events-none absolute inset-x-0 bottom-0 hidden rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-semibold text-white">${icon('check', 'mr-0.5 inline h-3 w-3 text-brand')} ${s.label}</span>
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
  $('[data-badge]', el).classList.toggle('hidden', !has);
  const remove = $('[data-remove]', el);
  remove.classList.toggle('hidden', !has);
  remove.classList.toggle('flex', has);
  $('label', el).classList.toggle('border-solid', has);
  $('label', el).classList.toggle('border-brand/60', has);
  if (!has) $('[data-photo-input]', el).value = '';
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

function showError(message) {
  const el = $('#form-error');
  el.textContent = message;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function onSubmit(e, context) {
  e.preventDefault();
  if (submitting) return;
  submitting = true;
  $('#form-error').classList.add('hidden');

  const button = $('#submit-btn');
  setLoading(button, true, Object.keys(photos).length ? 'Качване на снимките…' : 'Изпращане…');
  try {
    const checkin = await backend.submitCheckin(token, collect(e.currentTarget));
    renderSuccess(checkin, context);
  } catch (err) {
    showError(errorMessage(err));
    if (err?.code === 'validation/weight') $('#weight').focus();
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

  const tile = (label, value) => `
    <div class="rounded-2xl bg-ink-850 p-3 ring-1 ring-white/5">
      <p class="text-lg font-bold tabular-nums">${value}</p>
      <p class="text-[11px] text-zinc-500">${label}</p>
    </div>`;
  $('#success-summary').innerHTML = [
    tile('тегло', `${formatNumber(checkin.weight)} кг`),
    tile('сън', `${checkin.sleep}/10`),
    tile('енергия', `${checkin.energy}/10`),
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
    $('#week-label').textContent = `Седмица ${week}, ${year}`;
    $('#hello-name').textContent = context.clientName.split(' ')[0];
    if (context.coachName) $('#coach-name').textContent = context.coachName;
    $('#clientName').value = context.clientName;
    document.title = `Чек-ин · ${context.clientName} · FitCheck`;

    $$('[data-score]').forEach(bindScore);
    renderMeasurements();
    renderPhotoSlots();

    const comment = $('#comment');
    comment.addEventListener('input', () => { $('#comment-count').textContent = comment.value.length; });

    const form = $('#checkin-form');
    form.addEventListener('submit', (e) => onSubmit(e, context));
    show('checkin-form');
  } catch (err) {
    console.error(err);
    $('#view-invalid h1').textContent = 'Нещо се обърка';
    $('#view-invalid p').textContent = `${errorMessage(err)} Опитайте да презаредите страницата.`;
    show('view-invalid');
  }
}

main();
