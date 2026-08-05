import type { Config } from 'tailwindcss';

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        brand: { 50: '#f0f5ff', 100: '#dfeaff', 500: '#5b6cf9', 600: '#4958e8', 700: '#3e49c5' },
        coral: '#ff6b67',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: {
        soft: '0 10px 35px -15px rgba(33, 42, 75, .18)',
        card: '0 8px 30px rgba(42, 51, 92, .08)',
      },
      animation: { 'float-slow': 'float 6s ease-in-out infinite' },
      keyframes: { float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } },
    },
  },
  plugins: [],
} satisfies Config;
