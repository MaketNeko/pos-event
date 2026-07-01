/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Luxury Elegant Dark palette
        ink: '#171719',        // black diamond — main background
        odyssey: '#364958',    // secondary surface / cards
        pewter: '#89A6B8',     // muted text / borders
        milky: '#E8FDFF',      // primary text
        electrum: '#E7CB9C',   // CTA / accent
        cacao: '#745C4E',      // secondary accent / hover
        surface: '#1e2226',
        'surface-2': '#252b31',
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
