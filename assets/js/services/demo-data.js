/**
 * Demo dataset for the local adapter. Only used by `seedDemo()`; never imported by UI code.
 */
import { uid } from '../lib/utils.js';

export const DEMO_COACH = { name: 'Иво Петров', email: 'coach@demo.coachportal.app', password: 'demo1234' };
export const DEMO_CLIENT = { name: 'Мария Петрова', email: 'client@demo.coachportal.app', password: 'demo1234' };

const DAY = 24 * 60 * 60 * 1000;

/** Deterministic PRNG so the demo looks the same every time. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeholderPhoto(view, shade) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
<rect width="300" height="400" fill="hsl(240,4%,${shade}%)"/>
<g fill="hsl(240,4%,${shade + 10}%)">
<circle cx="150" cy="88" r="34"/>
<path d="M95 140q55-22 110 0l14 120q-10 8-22 4l-6-70-6 196h-34l-1-120-1 120h-34l-6-196-6 70q-12 4-22-4z"/>
</g>
<text x="150" y="380" text-anchor="middle" font-family="Geist,Inter,Arial" font-size="16" font-weight="500" fill="hsl(240,4%,${shade + 30}%)" letter-spacing="2">${view.toUpperCase()}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const COMMENTS = [
  'Седмицата мина добре, спазих хранителния режим почти изцяло. Една вечеря навън в събота.',
  'Тренировките бяха тежки, но се чувствам по-силна. Сънят беше нарушен в сряда.',
  'Много работа тази седмица, пропуснах една тренировка. Водата я спазвах.',
  'Дрехите стават по-широки в талията.',
  'Леко подуване в началото на седмицата, иначе всичко по план.',
  'Увеличих тежестите на клек. Енергията сутрин е по-висока.',
];

const PROGRAMS = {
  maria: { workouts: ['', 'Push A', 'Pull A', '', 'Legs', 'Push B', 'Кардио 30 мин'], nutrition: '1 900 kcal · 130 г протеин\n3 основни хранения + 1 закуска', steps: 8000, checkinDay: 0 },
  georgi: { workouts: ['', 'Горна част', '', 'Долна част', '', 'Цяло тяло', ''], nutrition: '2 900 kcal · 170 г протеин', steps: 7000, checkinDay: 1 },
};

const CLIENTS = [
  { key: 'maria', name: 'Мария Петрова', email: DEMO_CLIENT.email, goal: '−6 кг до лятото', weeks: 8, lastDaysAgo: 1, start: 68.4, trend: -0.45, linked: true, replyLatest: false },
  { key: 'georgi', name: 'Георги Иванов', email: 'georgi@example.com', goal: '+4 кг мускулна маса', weeks: 6, lastDaysAgo: 9, start: 77.8, trend: 0.4, replyLatest: true },
  { key: 'elena', name: 'Елена Димитрова', email: '', goal: 'Рекомпозиция', weeks: 5, lastDaysAgo: 19, start: 61.2, trend: -0.15, replyLatest: true },
  { key: 'nikolay', name: 'Николай Стоянов', email: 'niki@example.com', goal: 'Полумаратон', weeks: 0, lastDaysAgo: null, start: 84, trend: 0 },
  { key: 'dimitar', name: 'Димитър Колев', email: '', goal: '−10 кг', weeks: 4, lastDaysAgo: 0, start: 96.2, trend: -0.7, replyLatest: false },
];

const clamp = (n) => Math.min(10, Math.max(1, Math.round(n)));

export function buildDemoData(coachId, clientUserId) {
  const rand = mulberry32(42);
  const now = Date.now();
  const clients = {};
  const checkins = {};
  const links = {};
  const notes = {};

  CLIENTS.forEach((spec, idx) => {
    const client = {
      id: uid(),
      coachId,
      name: spec.name,
      email: spec.email,
      goal: spec.goal,
      token: uid(24),
      program: PROGRAMS[spec.key] ?? null,
      createdAt: now - (spec.weeks + 2) * 7 * DAY - idx * DAY,
      ...(spec.linked ? { userId: clientUserId } : {}),
    };
    clients[client.id] = client;
    links[client.token] = { clientId: client.id, coachId };
    if (spec.key === 'maria') notes[client.id] = { text: 'Предпочита кратки тренировки сутрин. Лека болка в лявото коляно — без дълбоки клекове.', updatedAt: now - 10 * DAY };

    let weight = spec.start;
    let waist = 80 + idx * 4;
    for (let w = 0; w < spec.weeks; w++) {
      const weeksAgo = spec.weeks - 1 - w;
      const createdAt = now - (spec.lastDaysAgo + weeksAgo * 7) * DAY - Math.floor(rand() * 5) * 60 * 60 * 1000;
      if (w > 0) weight += spec.trend + (rand() - 0.5) * 0.5;
      waist += spec.trend * 0.8 + (rand() - 0.5) * 0.4;
      const latest = weeksAgo === 0;
      const recent = weeksAgo < 2;

      checkins[uid()] = {
        token: client.token,
        clientId: client.id,
        coachId,
        clientName: spec.name,
        weight: Math.round(weight * 10) / 10,
        sleep: clamp(6 + rand() * 4 - 1),
        energy: clamp(6 + rand() * 4 - 1),
        ...(recent ? { stress: clamp(3 + rand() * 4), hunger: clamp(4 + rand() * 3), adherence: clamp(7 + rand() * 3), performance: clamp(6 + rand() * 4) } : {}),
        measurements: w % 2 === 0 || recent ? { waist: Math.round(waist * 10) / 10, hips: Math.round((waist + 18) * 10) / 10 } : {},
        photos: recent ? { front: placeholderPhoto('front', 14), side: placeholderPhoto('side', 16), back: placeholderPhoto('back', 18) } : {},
        comment: COMMENTS[Math.floor(rand() * COMMENTS.length)],
        coachNote: !latest || spec.replyLatest ? 'Добра седмица. Продължавай по същия начин, добави 10 минути разходка след вечеря.' : '',
        coachNoteAt: !latest || spec.replyLatest ? createdAt + 6 * 60 * 60 * 1000 : null,
        createdAt,
      };
    }
  });

  // Give check-ins their ids
  const withIds = {};
  for (const [id, c] of Object.entries(checkins)) withIds[id] = { id, ...c };

  return { clients, checkins: withIds, links, notes };
}
