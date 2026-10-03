/**
 * Demo dataset for the local adapter ("Пробвай демо").
 */
import { uid } from '../lib/utils.js';

export const DEMO_COACH = { name: 'Демо Треньор', email: 'demo@fitcheck.app', password: 'demo1234' };

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

function placeholderPhoto(view, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,22%)"/><stop offset="1" stop-color="hsl(${hue},30%,9%)"/></linearGradient></defs>
<rect width="300" height="400" fill="url(#g)"/>
<g fill="hsla(${hue},40%,75%,.28)">
<circle cx="150" cy="88" r="34"/>
<path d="M95 140q55-22 110 0l14 120q-10 8-22 4l-6-70-6 196h-34l-1-120-1 120h-34l-6-196-6 70q-12 4-22-4z"/>
</g>
<text x="150" y="380" text-anchor="middle" font-family="Inter,Arial" font-size="18" font-weight="600" fill="hsla(${hue},40%,85%,.55)" letter-spacing="3">${view.toUpperCase()}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const COMMENTS = [
  'Седмицата мина добре, спазих хранителния режим почти изцяло. Една вечеря навън в събота.',
  'Тренировките бяха тежки, но се чувствам по-силен/а. Сънят беше нарушен в сряда.',
  'Много работа тази седмица, пропуснах една тренировка. Водата я спазвах.',
  'Чувствам се страхотно! Дрехите стават по-широки в талията.',
  'Леко подуване в началото на седмицата, иначе всичко по план.',
  'Имах рожден ден в петък — малко отклонение, но се върнах в релси веднага.',
  'Енергията е много по-висока сутрин. Увеличих тежестите на клек.',
  'Трудна седмица психически, но не пропуснах нито едно хранене.',
];

const CLIENTS = [
  { name: 'Мария Петрова', email: 'maria@example.com', goal: '−6 кг до лятото', weeks: 8, lastDaysAgo: 2, start: 68.4, trend: -0.45, hue: 330 },
  { name: 'Георги Иванов', email: 'georgi@example.com', goal: '+4 кг мускулна маса', weeks: 6, lastDaysAgo: 10, start: 77.8, trend: 0.4, hue: 200 },
  { name: 'Елена Димитрова', email: '', goal: 'Рекомпозиция и по-добър сън', weeks: 5, lastDaysAgo: 19, start: 61.2, trend: -0.15, hue: 160 },
  { name: 'Николай Стоянов', email: 'niki@example.com', goal: 'Подготовка за полумаратон', weeks: 0, lastDaysAgo: null, start: 84, trend: 0, hue: 40 },
];

export function buildDemoData(coachId) {
  const rand = mulberry32(42);
  const now = Date.now();
  const clients = {};
  const checkins = {};
  const links = {};

  CLIENTS.forEach((spec, idx) => {
    const client = {
      id: uid(),
      coachId,
      name: spec.name,
      email: spec.email,
      goal: spec.goal,
      token: uid(24),
      createdAt: now - (spec.weeks + 1) * 7 * DAY - idx * DAY,
    };
    clients[client.id] = client;
    links[client.token] = { clientId: client.id, coachId };

    let weight = spec.start;
    let waist = 80 + idx * 4;
    for (let w = 0; w < spec.weeks; w++) {
      const weeksAgo = spec.weeks - 1 - w;
      const createdAt = now - (spec.lastDaysAgo + weeksAgo * 7) * DAY - Math.floor(rand() * 6) * 60 * 60 * 1000;
      if (w > 0) weight += spec.trend + (rand() - 0.5) * 0.5;
      waist += spec.trend * 0.8 + (rand() - 0.5) * 0.4;
      const isRecent = weeksAgo < 2;

      const checkin = {
        id: uid(),
        token: client.token,
        clientId: client.id,
        coachId,
        clientName: spec.name,
        weight: Math.round(weight * 10) / 10,
        sleep: Math.min(10, Math.max(3, Math.round(6 + rand() * 4 - 1))),
        energy: Math.min(10, Math.max(3, Math.round(6 + rand() * 4 - 1))),
        measurements: w % 2 === 0 || isRecent
          ? { waist: Math.round(waist * 10) / 10, hips: Math.round((waist + 18) * 10) / 10, chest: Math.round((waist + 14) * 10) / 10 }
          : {},
        photos: isRecent
          ? { front: placeholderPhoto('front', spec.hue), side: placeholderPhoto('side', spec.hue + 20), back: placeholderPhoto('back', spec.hue + 40) }
          : {},
        comment: COMMENTS[Math.floor(rand() * COMMENTS.length)],
        coachNote: weeksAgo === 1 ? 'Чудесна работа! Тази седмица добави 10 мин. разходка след вечеря.' : '',
        createdAt,
      };
      checkins[checkin.id] = checkin;
    }
  });

  return { clients, checkins, links };
}
