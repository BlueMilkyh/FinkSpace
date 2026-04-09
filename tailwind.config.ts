import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--color-surface)",
          light: "var(--color-surface-light)",
          lighter: "var(--color-surface-lighter)",
          border: "var(--color-surface-border)",
        },
        // Override "white" so text-white, text-white/50 etc. adapt to theme
        white: "rgb(var(--color-fg) / <alpha-value>)",
        accent: {
          red: "#e74c3c",
          orange: "#e67e22",
          yellow: "#f1c40f",
          green: "#2ecc71",
          blue: "#3498db",
          purple: "#9b59b6",
          pink: "#e91e63",
          cyan: "#00bcd4",
        },
      },
      textColor: {
        primary: "var(--color-text)",
        secondary: "var(--color-text-secondary)",
      },
      backgroundColor: {
        "hover-overlay": "var(--color-hover-bg)",
      },
    },
  },
  plugins: [],
} satisfies Config;
