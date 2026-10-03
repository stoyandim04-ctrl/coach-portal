#!/usr/bin/env node
/**
 * Design lint — flags Tailwind classes that break DESIGN.md.
 *
 *   node scripts/design-lint.mjs                 # checks the migrated sections
 *   node scripts/design-lint.mjs path/a path/b   # checks specific files
 *
 * Exit code 1 when violations are found.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Sections already migrated to DESIGN.md. Add files here as each section is rebuilt.
const MIGRATED = [
  'dashboard.html',
  'assets/js/pages/dashboard.js',
  'assets/js/lib/ui.js',
  'assets/js/lib/model.js',
  'checkin.html',
  'assets/js/pages/checkin.js',
];

const SPACING = new Set(['0', 'px', '1', '2', '3', '4', '6', '8', '12', '16']);
const SIZES = new Set([...SPACING, '5', '10', '14', 'chart', 'full', 'auto', 'screen', 'min', 'max', 'fit', 'dvh', 'svh', 'lvh']);
const FRACTION = /^\d+\/\d+$/;
const TEXT_SIZES = new Set(['caption', 'small', 'body', 'title', 'headline', 'display']);
const COLORS = new Set(['canvas', 'surface', 'raised', 'line', 'fg', 'muted', 'subtle', 'accent', 'accent-fg', 'success', 'warning', 'danger', 'info', 'white', 'black', 'transparent', 'current']);
const RADII = new Set(['', 'none', 'sm', 'md', 'lg', 'xl', 'full']);
const WEIGHTS = new Set(['normal', 'medium', 'semibold']);
const FONTS = new Set(['sans', 'display']);
// Custom utilities defined in assets/css/app.css (safe-area aware).
const CUSTOM = new Set(['pt-safe', 'pb-safe', 'bottom-safe']);

const SPACING_UTIL = /^-?(px|py|pt|pr|pb|pl|ps|pe|p|mx|my|mt|mr|mb|ml|ms|me|m|gap-x|gap-y|gap|space-x|space-y|inset-x|inset-y|inset|top|right|bottom|left|start|end|translate-x|translate-y|scroll-m|scroll-p)-(.+)$/;
const SIZE_UTIL = /^(w|h|size|min-w|min-h|max-h)-(.+)$/;
const COLOR_UTIL = /^(bg|text|ring-offset|ring|border-[trblxy]|border|divide|outline|fill|stroke|from|via|to|placeholder|decoration|caret|shadow)-([a-z]+(?:-[a-z]+)?(?:-\d{2,3})?)(?:\/\d+)?$/;

function check(cls) {
  // Strip variants (sm:, hover:, group-hover:, …) — keep arbitrary-variant brackets intact.
  const base = cls.replace(/^(?:[a-z0-9-]+:|\[[^\]]+\]:)+/, '').replace(/^!/, '');
  if (!base || !/^-?[a-z]/.test(base) || CUSTOM.has(base)) return null;

  if (/-\[[^\]]+\]/.test(base)) return 'произволна стойност — използвай токен';

  let m = base.match(SPACING_UTIL);
  if (m) return SPACING.has(m[2]) || FRACTION.test(m[2]) || m[2] === 'full' || m[2] === 'auto' ? null : `отстояние „${m[2]}“ не е в скалата`;

  m = base.match(SIZE_UTIL);
  if (m) return SIZES.has(m[2]) || FRACTION.test(m[2]) || /^(xs|sm|md|lg|xl|\dxl|prose|none)$/.test(m[2]) ? null : `размер „${m[2]}“ не е в скалата`;

  m = base.match(/^rounded(?:-[trblse]{1,2})?(?:-(.+))?$/);
  if (m) return RADII.has(m[1] ?? '') ? null : `радиус „${m[1]}“ не е в скалата`;

  m = base.match(/^font-(.+)$/);
  if (m) {
    if (FONTS.has(m[1]) || WEIGHTS.has(m[1])) return null;
    return `шрифт/тегло „${m[1]}“ е забранено`;
  }

  m = base.match(/^text-(xs|sm|base|lg|xl|\dxl)$/);
  if (m) return `размер „text-${m[1]}“ — използвай caption/small/body/title/headline/display`;

  m = base.match(COLOR_UTIL);
  if (m) {
    const [, util, value] = m;
    if (util === 'text' && (TEXT_SIZES.has(value) || /^(left|right|center|justify|ellipsis|clip|wrap|nowrap|balance|pretty|start|end)$/.test(value))) return null;
    if (util === 'shadow' && /^(overlay|accent|none|sm|md|lg|xl|2xl|inner)$/.test(value)) return null;
    if (/^(border|ring|outline|divide)/.test(util) && /^(0|2|4|8|solid|dashed|dotted|none|offset|inset|opacity)$/.test(value)) return null;
    if (/^(x|y|t|r|b|l)$/.test(value)) return null;
    if (util === 'bg' && /^(gradient|clip|fixed|cover|contain|center|none|no|repeat|origin|blend|opacity|top|bottom|left|right|local|scroll|auto)/.test(value)) return null;
    if (util === 'decoration' || util === 'fill' || util === 'stroke') return null;
    if (/^(from|via|to)$/.test(util)) return COLORS.has(value) ? null : `цвят „${value}“ не е токен`;
    return COLORS.has(value) ? null : `цвят „${value}“ не е токен`;
  }
  return null;
}

function classTokens(source) {
  const tokens = [];
  // class="…" attributes, and Tailwind-looking tokens inside JS template strings / string literals.
  const re = /(?:class(?:Name)?=["'`])([^"'`]*)["'`]|[`'"]([^`'"\n]*)[`'"]/g;
  let match;
  while ((match = re.exec(source))) {
    const chunk = match[1] ?? match[2] ?? '';
    for (const t of chunk.split(/\s+/)) if (t && /^[!a-z\-[\]0-9:/.&_]+$/.test(t) && /[-:]/.test(t)) tokens.push(t);
  }
  return tokens;
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : MIGRATED.map((f) => join(root, f));
let total = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const seen = new Set();
  for (const token of classTokens(src)) {
    if (seen.has(token)) continue;
    seen.add(token);
    const problem = check(token);
    if (problem) {
      total++;
      const line = src.slice(0, src.indexOf(token)).split('\n').length;
      console.log(`${relative(root, file)}:${line}  ${token}  → ${problem}`);
    }
  }
}

if (total) {
  console.log(`\n✖ ${total} нарушения на DESIGN.md`);
  process.exit(1);
}
console.log(`✔ DESIGN.md — без нарушения (${files.length} файла)`);
