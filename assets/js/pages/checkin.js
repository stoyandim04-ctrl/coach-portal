/**
 * Weekly check-in (checkin.html?t=<token>). Public by token; also opened from the client app.
 * Four short steps instead of one long form: recovery → nutrition & training → photos → comment.
 */
import { getBackend } from '../services/backend.js';
import { $, $$, escapeHtml, errorMessage, compressImage, isoWeek, formatNumber } from '../lib/utils.js';
import { SCORES, MEASUREMENTS, PHOTO_SLOTS, ROLES } from '../lib/model.js';
import { icon, cx, setLoading, toast } from '../lib/ui.js';

const token = new URLSearchParams(window.location.search).get('t');
const view = $('#view');
const STEPS = [
  { title: 'Тегло и възстановяване', scores: ['sleep', 'energy', 'stress'] },
  { title: 'Хранене и тренировки', scores: ['hunger', 'adherence', 'performance'] },
  { title: 'Снимки' },
  { title: 'Коментар' },
];

const values = { weight: '', comment: '', measurements: {}, sleep: 7, energy: 7, stress: 4, hunger: 5, adherence: 8, performance: 7 };
const photos = {}; // slot → { dataUrl, blob }
let step = 0;
let backend;
let context;
let isClientUser = false;
let submitting = false;

/* ---------- Fields ---------- */

function scoreField(key) {
  const s = SCORES.find((x) => x.key === key);
  const v = values[key];
  return `
    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-4">
        <label for="${key}" class="text-body">${s.label}</label>
        <span class="text-body font-medium tabular-nums"><span data-value="${key}">${v}</span><span class="text-subtle">/10</span></span>
      </div>
      <input id="${key}" name="${key}" type="range" min="1" max="10" step="1" value="${v}" class="cp-range" style="--fill:${((v - 1) / 9) * 100}%" />
      <div class="flex justify-between text-caption text-subtle"><span>${s.low}</span><span>${s.high}</span></div>
    </div>`;
}

function stepRecovery() {
  return `
    <div class="flex flex-col gap-8">
      <div class="flex flex-col gap-2">
        <label for="weight" class="text-body">Тегло тази сутрин</label>
        <div class="${cx.fieldRow}">
          <input id="weight" name="weight" type="text" inputmode="decimal" autocomplete="off" placeholder="0,0" value="${escapeHtml(values.weight)}"
            class="w-full min-w-0 bg-transparent text-display font-semibold tabular-nums text-fg placeholder-subtle focus:outline-none" />
          <span class="text-body text-muted">кг</span>
        </div>
        <p id="weight-error" class="hidden text-small text-danger" role="alert"></p>
        <p class="text-caption text-subtle">Сутрин, на гладно.</p>
      </div>
      ${STEPS[0].scores.map(scoreField).join('')}
    </div>`;
}

function stepNutrition() {
  return `
    <div class="flex flex-col gap-8">
      ${STEPS[1].scores.map(scoreField).join('')}
      <details class="group rounded-md border border-line bg-surface" ${Object.keys(values.measurements).length ? 'open' : ''}>
        <summary class="tap flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
          <span class="text-body">Мерки <span class="text-muted">· по избор</span></span>
          <span class="text-subtle transition group-open:rotate-90">${icon('chevronRight', 'h-4 w-4')}</span>
        </summary>
        <div class="flex flex-col divide-y divide-line border-t border-line">
          ${MEASUREMENTS.map((m) => `
            <label class="flex min-h-14 items-center gap-3 px-4">
              <span class="flex-1"><span class="block text-body">${m.label}</span><span class="block text-caption text-subtle">${m.hint}</span></span>
              <input name="m_${m.key}" data-measure="${m.key}" type="text" inputmode="decimal" autocomplete="off" placeholder="—" value="${escapeHtml(values.measurements[m.key] ?? '')}"
                class="w-1/4 bg-transparent text-right text-body tabular-nums text-fg placeholder-subtle focus:outline-none" />
              <span class="text-small text-subtle">см</span>
            </label>`).join('')}
        </div>
      </details>
      <p id="measure-error" class="hidden text-small text-danger" role="alert"></p>
    </div>`;
}

function stepPhotos() {
  return `
    <div class="flex flex-col gap-4">
      <p class="text-small text-muted">Същото място и светлина всяка седмица. Вижда ги само треньорът ти. Можеш да пропуснеш.</p>
      <div class="grid grid-cols-3 gap-2">
        ${PHOTO_SLOTS.map((s) => {
          const p = photos[s.key];
          return `
            <div class="relative" data-slot="${s.key}">
              <label class="tap photo-slot flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-md border ${p ? 'border-line' : 'border-dashed border-line'} bg-surface text-muted focus-within:border-accent">
                <input type="file" accept="image/*" class="sr-only" data-photo-input="${s.key}" aria-label="Снимка ${s.label}" />
                ${p ? `<img src="${p.dataUrl}" alt="${s.label}" class="h-full w-full object-cover" />` : `${icon('camera')}<span class="text-small">${s.label}</span>`}
                <span data-busy class="absolute inset-0 hidden items-center justify-center bg-black/60 text-fg"><span class="spinner"></span></span>
              </label>
              ${p ? `<button type="button" data-remove="${s.key}" class="tap absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md bg-black/60 text-fg" aria-label="Премахни ${s.label}">${icon('x', 'h-4 w-4')}</button>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function stepComment() {
  return `
    <div class="flex flex-col gap-2">
      <label class="${cx.field}">
        <span class="${cx.fieldLabel}">Как мина седмицата?</span>
        <textarea id="comment" name="comment" rows="6" maxlength="2000" placeholder="Хранене, тренировки, стрес, победи" class="${cx.input} resize-none">${escapeHtml(values.comment)}</textarea>
      </label>
      <p class="text-caption text-subtle">По избор</p>
    </div>`;
}

const RENDERERS = [stepRecovery, stepNutrition, stepPhotos, stepComment];

/* ---------- Rendering ---------- */

function renderStep() {
  $('#step-label').textContent = `Стъпка ${step + 1} от ${STEPS.length}`;
  const bar = $('#progress');
  bar.innerHTML = STEPS.map((_, i) => `<span class="h-1 flex-1 rounded-full ${i <= step ? 'bg-fg' : 'bg-line'}"></span>`).join('');
  bar.setAttribute('aria-valuenow', String(step + 1));

  view.innerHTML = `
    <div class="animate-fade-in flex flex-col gap-8 pt-4">
      <h1 class="text-headline font-semibold">${STEPS[step].title}</h1>
      ${RENDERERS[step]()}
    </div>`;

  $('#back-btn').innerHTML = icon('chevronLeft', 'h-6 w-6');
  $('#back-btn').classList.toggle('invisible', step === 0);
  $('#next-btn').textContent = step === STEPS.length - 1 ? 'Изпрати check-in' : 'Напред';
  window.scrollTo({ top: 0 });
  bindStep();
}

function bindStep() {
  $$('.cp-range', view).forEach((input) => input.addEventListener('input', () => {
    const v = Number(input.value);
    values[input.name] = v;
    $(`[data-value="${input.name}"]`).textContent = v;
    input.style.setProperty('--fill', `${((v - 1) / 9) * 100}%`);
  }));
  $('#weight')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');
    values.weight = e.target.value;
    $('#weight-error').classList.add('hidden');
  });
  $$('[data-measure]', view).forEach((input) => input.addEventListener('input', () => {
    input.value = input.value.replace(/[^\d.,]/g, '');
    if (input.value) values.measurements[input.dataset.measure] = input.value;
    else delete values.measurements[input.dataset.measure];
  }));
  $('#comment')?.addEventListener('input', (e) => { values.comment = e.target.value; });
  $$('[data-photo-input]', view).forEach((input) => input.addEventListener('change', onPhoto));
  $$('[data-remove]', view).forEach((btn) => btn.addEventListener('click', () => {
    delete photos[btn.dataset.remove];
    renderStep();
  }));
}

async function onPhoto(e) {
  const input = e.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  const busy = input.closest('[data-slot]').querySelector('[data-busy]');
  busy.classList.replace('hidden', 'flex');
  try {
    photos[input.dataset.photoInput] = await compressImage(file, backend.photoOptions);
    renderStep();
  } catch (err) {
    toast(errorMessage(err), 'error');
    busy.classList.replace('flex', 'hidden');
  }
}

/* ---------- Navigation ---------- */

function validWeight() {
  const n = Number(String(values.weight).replace(',', '.'));
  return values.weight !== '' && Number.isFinite(n) && n >= 25 && n <= 350;
}

async function next() {
  if (step === 0 && !validWeight()) {
    const el = $('#weight-error');
    el.textContent = 'Въведете тегло в килограми, напр. 72,5.';
    el.classList.remove('hidden');
    $('#weight').focus();
    return;
  }
  if (step < STEPS.length - 1) {
    step += 1;
    renderStep();
    return;
  }
  await submit();
}

async function submit() {
  if (submitting) return;
  submitting = true;
  const button = $('#next-btn');
  setLoading(button, true, Object.keys(photos).length ? 'Качване…' : 'Изпращане…');
  try {
    const checkin = await backend.submitCheckin(token, {
      clientName: context.clientName,
      weight: values.weight,
      ...Object.fromEntries(SCORES.map((s) => [s.key, values[s.key]])),
      measurements: values.measurements,
      comment: values.comment,
      photos: { ...photos },
    });
    renderSuccess(checkin);
  } catch (err) {
    setLoading(button, false);
    if (err?.code === 'validation/weight') {
      step = 0;
      renderStep();
    } else if (err?.code === 'validation/measurement') {
      step = 1;
      renderStep();
      const el = $('#measure-error');
      el.textContent = errorMessage(err);
      el.classList.remove('hidden');
      return;
    }
    toast(errorMessage(err), 'error');
  } finally {
    submitting = false;
  }
}

function renderSuccess(checkin) {
  $('#action-bar').classList.add('hidden');
  $('#progress').classList.add('hidden');
  $('#progress').classList.remove('flex');
  $('#step-label').textContent = '';
  view.innerHTML = `
    <div class="animate-fade-in flex min-h-full flex-col items-center pt-16 text-center">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-success">
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="check-path" d="M20 6 9 17l-5-5" /></svg>
      </span>
      <h1 class="mt-6 text-headline font-semibold">Check-in-ът е изпратен</h1>
      <p class="mt-2 text-body text-muted">${escapeHtml(context.coachName || 'Треньорът ти')} ще го прегледа скоро.</p>
      <div class="mt-8 w-full ${cx.list}">
        <div class="flex min-h-14 items-center justify-between px-4"><span class="text-muted">Тегло</span><span class="tabular-nums">${formatNumber(checkin.weight)} кг</span></div>
        <div class="flex min-h-14 items-center justify-between px-4"><span class="text-muted">Сън</span><span class="tabular-nums">${checkin.sleep}/10</span></div>
        <div class="flex min-h-14 items-center justify-between px-4"><span class="text-muted">Енергия</span><span class="tabular-nums">${checkin.energy}/10</span></div>
      </div>
      ${isClientUser ? `<a href="client.html" class="${cx.btnPrimary} mt-8 w-full">Към началото</a>` : ''}
    </div>`;
  window.scrollTo({ top: 0 });
}

function renderInvalid(title, text) {
  view.innerHTML = `
    <div class="animate-fade-in flex flex-col items-center pt-16 text-center">
      <span class="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-danger">${icon('alert')}</span>
      <h1 class="mt-6 text-title font-semibold">${title}</h1>
      <p class="mt-2 max-w-xs text-small text-muted">${text}</p>
    </div>`;
}

/* ---------- Boot ---------- */

async function main() {
  try {
    backend = await getBackend();
    context = token ? await backend.getCheckinContext(token) : null;
    if (!context) {
      renderInvalid('Линкът не е валиден', `Помолете треньора си за нов линк.${backend.kind === 'local' ? ' В демо режим линковете работят само в браузъра, в който са създадени.' : ''}`);
      return;
    }

    const user = await backend.getCurrentUser().catch(() => null);
    isClientUser = user?.role === ROLES.client;
    if (isClientUser) {
      const close = $('#close-link');
      close.className = `${cx.iconBtn} -ml-3`;
      close.innerHTML = icon('x');
    }

    $('#week-label').textContent = `Седмица ${isoWeek(Date.now()).week}`;
    document.title = `Check-in · ${context.clientName}`;
    $('#progress').classList.replace('hidden', 'flex');
    $('#action-bar').classList.remove('hidden');
    $('#next-btn').addEventListener('click', next);
    $('#back-btn').addEventListener('click', () => {
      if (step > 0) {
        step -= 1;
        renderStep();
      }
    });
    // Enter on the weight field moves forward (mobile "Go" key).
    view.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'weight') {
        e.preventDefault();
        next();
      }
    });
    renderStep();
  } catch (err) {
    console.error(err);
    renderInvalid('Нещо се обърка', `${escapeHtml(errorMessage(err))} Презаредете страницата.`);
  }
}

main();
