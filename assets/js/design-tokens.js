/* FitCheck design tokens — single source of truth for DESIGN.md. Classic script (no module). */
window.FitCheckDesign = {
  colors: {
    canvas: '#09090B',
    surface: '#111113',
    raised: '#1A1A1E',
    line: '#26262B',
    fg: '#F4F4F5',
    muted: '#A1A1AA',
    subtle: '#71717A',
    accent: '#C8F31D',
    'accent-fg': '#0B0C06',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
  },

  // Two typefaces only.
  fontFamily: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
    display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  },

  // Six-step type scale: [size, line-height].
  fontSize: {
    caption: ['12px', { lineHeight: '16px' }],
    small: ['14px', { lineHeight: '20px' }],
    body: ['16px', { lineHeight: '24px' }],
    title: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
    headline: ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
    display: ['40px', { lineHeight: '48px', letterSpacing: '-0.02em' }],
  },

  fontWeight: { normal: '400', medium: '500', semibold: '600' },

  // Strict 4px spacing scale (padding, margin, gap, inset, translate).
  spacing: {
    0: '0px', px: '1px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px', 16: '64px',
  },

  // Extra component sizes (width / height only).
  sizes: { 5: '20px', 10: '40px', 14: '56px', chart: '160px' },

  borderRadius: { none: '0px', sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px' },

  boxShadow: {
    overlay: '0 16px 48px -12px rgba(0,0,0,.7)',
    accent: '0 0 0 1px rgba(200,243,29,.25), 0 8px 24px -8px rgba(200,243,29,.4)',
  },
};
