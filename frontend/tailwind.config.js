/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      keyframes: {
        soundWave: {
          "0%, 100%": { transform: "scaleY(0.2)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
    },
  },
  plugins: [],
};
