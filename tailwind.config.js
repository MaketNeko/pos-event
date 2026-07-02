/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface2) / <alpha-value>)',
        milky: 'rgb(var(--c-text) / <alpha-value>)',
        pewter: 'rgb(var(--c-muted) / <alpha-value>)',
        electrum: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-on': 'rgb(var(--c-accent-on) / <alpha-value>)',
        divider: 'rgb(var(--c-divider) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        odyssey: '#364958',
        cacao: '#745C4E',
      },
      fontFamily: {
        sans: ['Niramit', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Trirong', 'Playfair Display', 'serif'],
        num: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}
