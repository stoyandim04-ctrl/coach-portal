/* Shared Tailwind (Play CDN) theme. Loaded right after cdn.tailwindcss.com on every page. */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
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
        glow: '0 0 0 1px rgba(200,243,29,.25), 0 8px 30px -8px rgba(200,243,29,.35)',
        card: '0 1px 0 0 rgba(255,255,255,.04) inset, 0 10px 30px -15px rgba(0,0,0,.6)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
};
