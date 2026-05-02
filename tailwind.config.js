/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        cream: '#FFF8E7',
        'cream-dark': '#F5EDD6',
        ink: '#2C2C2C',
        'ink-light': '#6B6B6B',
        'ruled-line': '#D4C5A9',
        accent: '#E8734A',
      },
    },
  },
  plugins: [],
};
