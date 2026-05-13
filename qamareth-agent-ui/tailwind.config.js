// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            color: "#F5F1E8",
            "h1,h2,h3": {
              color: "#FFD166",
            },
            strong: {
              color: "#E55A3C",
            },
            code: {
              backgroundColor: "#2E2E3E",
              color: "#F5F1E8",
              padding: "0.1em 0.2em",
              borderRadius: "0.25rem",
            },
            "pre": {
              backgroundColor: "#1E1E2C",
            },
          }
        }
      }
    }
  },
  plugins: [require("@tailwindcss/typography")],
};

module.exports = config;