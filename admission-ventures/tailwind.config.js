/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#13201f", soft: "#3d4f4d", mute: "#6b7d7a" },
        brand: { 50: "#eef6f5", 100: "#d6eae8", 200: "#aed4d0", 500: "#1f7a76", 600: "#176461", 700: "#0f4d4b", 800: "#0f3d3e", 900: "#0a2c2d" },
        amber: { DEFAULT: "#f2b84b", deep: "#b97c0a", soft: "#fdf3dc" },
        paper: "#fbfaf6",
        line: "#e3e1d8",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans", "Noto Sans Bengali", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Georgia", "Cambria", "Noto Serif Bengali", "Times New Roman", "serif"],
      },
      boxShadow: { card: "0 1px 0 rgba(19,32,31,.04), 0 8px 24px -12px rgba(19,32,31,.18)" },
    },
  },
  plugins: [],
};
