/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#F40009',
          'red-hover': '#FC1B1C',
          navy: '#0C2C84',
        },
        accent: {
          green: '#059669',
          yellow: '#D97706',
          red: '#F40009',
          blue: '#0C2C84',
          purple: '#FC1B1C',
        },
      },
      fontFamily: {
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
