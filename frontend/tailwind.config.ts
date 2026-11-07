import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { route: "#1a73e8" },
      boxShadow: { floating: "0 2px 8px rgba(60,64,67,.28)" },
    },
  },
  plugins: [],
} satisfies Config;
