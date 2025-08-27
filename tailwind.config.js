// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cinzel"', "serif"],
        sans: ['Inter', "system-ui", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
};
