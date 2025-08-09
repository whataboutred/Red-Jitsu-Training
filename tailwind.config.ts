import type { Config } from "tailwindcss"
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { brand: { red: "#E11D48", dark: "#0B0B0C", gray: "#16181D" } },
      borderRadius: { "2xl": "1rem" }
    },
  },
  plugins: [],
} satisfies Config
