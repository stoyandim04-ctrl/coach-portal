/*
 * Legacy Tailwind theme for pages not yet migrated to DESIGN.md (landing, check-in form).
 * It keeps the default scale and additionally exposes the design tokens, so shared
 * components (lib/ui.js) written with tokens render the same everywhere.
 * Requires design-tokens.js to be loaded first.
 */
const fcTokens = window.FitCheckDesign;
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: fcTokens.fontFamily,
      fontSize: fcTokens.fontSize,
      colors: {
        ...fcTokens.colors,
        ink: {
          950: '#07080A',
          900: '#0C0E11',
          850: '#111318',
          800: '#16191F',
          700: '#1E222A',
          600: '#2A2F39',
          500: '#3B414D',
        },
        brand: {
          DEFAULT: '#C8F31D',
          50: '#F8FDE6',
          300: '#DDF86F',
          400: '#D2F545',
          500: '#C8F31D',
          600: '#A6CC0C',
          700: '#7E9C08',
        },
      },
      boxShadow: {
        ...fcTokens.boxShadow,
        glow: '0 0 0 1px rgba(200,243,29,.25), 0 8px 30px -8px rgba(200,243,29,.35)',
        card: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 10px 30px -15px rgba(0,0,0,.6)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
