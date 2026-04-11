/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        garces: {
          cherry: "#8B1A1A",
          "cherry-light": "#B22222",
          "cherry-dark": "#5C0E0E",
          "cherry-pale": "#FDE8E8",
          "cherry-glow": "#DC2626",
          green: "#2D5016",
          "green-light": "#4A7C23",
          "green-pale": "#E8F5E0",
          earth: "#8B6914",
          "earth-light": "#D4A843",
          cream: "#FFF8F6",
        },
        estado: {
          success: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          info: "#3B82F6",
          neutral: "#9CA3AF",
        },
        especie: {
          cerezo: "#DC2626",
          carozo: "#F97316",
          nectarin: "#FBBF24",
          ciruela: "#8B5CF6",
        },
        labor: {
          poda: "#22C55E",
          fertilizacion: "#3B82F6",
          fitosanidad: "#F97316",
          riego: "#06B6D4",
          manejo: "#8B5CF6",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        serif: ["DM Serif Display", "Georgia", "serif"],
      },
      boxShadow: {
        "warm-sm": "0 1px 2px rgba(45, 80, 50, 0.05)",
        "warm-md": "0 4px 12px rgba(45, 80, 50, 0.08)",
        "warm-lg": "0 12px 40px rgba(45, 80, 50, 0.12)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
