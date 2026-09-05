/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6ff",
          100: "#e2ebff",
          200: "#c3d6ff",
          300: "#9ab6ff",
          400: "#6b8bff",
          500: "#3f5fee",
          600: "#2c42cc",
          700: "#2334a3",
          800: "#1e2b80",
          900: "#1b2568",
        },
        ink: {
          900: "#0f1424",
          800: "#1a2036",
          700: "#2a324d",
        },
        // Student Portal module used a separate `primary` token - kept as an
        // alias so those components render unchanged.
        primary: { DEFAULT: "#4F46E5", dark: "#4338CA" },
      },
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
