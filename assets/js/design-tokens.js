/* Coach Portal design tokens — single source of truth for DESIGN.md. Classic script (no module). */
window.CoachPortalDesign = {
  // Neutral graphite palette. One restrained accent; semantic colors are muted.
  colors: {
    canvas: '#0E0E10', // page background
    surface: '#161618', // rows, cards, sheets
    raised: '#1E1E21', // inputs, pressed/hover states
    line: '#2A2A2E', // borders and dividers
    fg: '#ECECEE', // primary text (soft white)
    muted: '#A1A1A8', // secondary text
    subtle: '#6F6F77', // metadata, placeholders
    accent: '#8B9CFF', // interaction state only: focus, selection, progress
    success: '#4FAF84',
    warning: '#D4A24C',
    danger: '#E2686A',
  },

  // One typeface.
  fontFamily: {
    sans: ['Geist', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  },

  // Restrained six-step type scale: [size, line-height].
  fontSize: {
    caption: ['13px', { lineHeight: '18px' }],
    small: ['14px', { lineHeight: '20px' }],
    body: ['16px', { lineHeight: '24px' }],
    title: ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
    headline: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
    display: ['32px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
  },

  fontWeight: { normal: '400', medium: '500', semibold: '600' },

  // Strict 4px spacing scale (padding, margin, gap, inset, translate).
  spacing: {
    0: '0px', px: '1px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
  },

  // Component sizes (width / height only).
  sizes: { 9: '36px', 11: '44px', 14: '56px', 18: '72px', chart: '160px' },

  // One main radius (md) for buttons, inputs, rows and cards.
  borderRadius: { none: '0px', sm: '8px', md: '12px', lg: '16px', full: '9999px' },

  boxShadow: {
    sheet: '0 -8px 32px rgba(0,0,0,.45)',
  },
};
