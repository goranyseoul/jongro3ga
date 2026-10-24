import type { Config } from "tailwindcss";

// Every design value is a CSS variable from app/globals.css. The default palette,
// spacing and radius scales are replaced (not extended) so only token names exist.
const spacing = {
  0: "0",
  "sp-1": "var(--sp-1)",
  "sp-2": "var(--sp-2)",
  "sp-3": "var(--sp-3)",
  "sp-4": "var(--sp-4)",
  "sp-5": "var(--sp-5)",
  "sp-6": "var(--sp-6)",
  "sp-8": "var(--sp-8)",
  "sp-12": "var(--sp-12)",
  "sp-16": "var(--sp-16)",
};

const colors = {
  transparent: "transparent",
  current: "currentColor",
  bg: "var(--bg)",
  elev: "var(--bg-elev)",
  sunken: "var(--bg-sunken)",
  popover: "var(--popover)",
  scrim: "var(--scrim)",
  border: "var(--border)",
  "border-soft": "var(--border-soft)",
  input: "var(--input)",
  text: "var(--text)",
  muted: "var(--text-muted)",
  subtle: "var(--text-subtle)",
  brand: "var(--brand)",
  "on-brand": "var(--accent-fg)",
  highlight: "var(--highlight)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // breakpoints cannot be CSS variables, values are fixed by 05-screens.md
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    colors,
    spacing,
    borderColor: ({ theme }) => ({ ...theme("colors"), DEFAULT: "var(--border)" }),
    ringColor: ({ theme }) => ({ ...theme("colors"), DEFAULT: "var(--brand)" }),
    borderRadius: {
      none: "0",
      sm: "var(--r-sm)",
      md: "var(--r-md)",
      card: "var(--r-card)",
      xl: "var(--r-xl)",
      "2xl": "var(--r-2xl)",
      "3xl": "var(--r-3xl)",
      "4xl": "var(--r-4xl)",
      pill: "var(--r-pill)",
    },
    boxShadow: {
      none: "none",
      card: "var(--sh-card)",
      pop: "var(--sh-pop)",
    },
    fontFamily: {
      sans: ["var(--font)"],
      mono: ["var(--font-mono)"],
    },
    fontSize: {
      display: ["var(--t-display)", { lineHeight: "var(--lh-tight)" }],
      h1: ["var(--t-h1)", { lineHeight: "var(--lh-tight)" }],
      h2: ["var(--t-h2)", { lineHeight: "var(--lh-snug)" }],
      title: ["var(--t-title)", { lineHeight: "var(--lh-snug)" }],
      body: ["var(--t-body)", { lineHeight: "var(--lh-normal)" }],
      label: ["var(--t-sm)", { lineHeight: "var(--lh-normal)" }],
      caption: ["var(--t-xs)", { lineHeight: "var(--lh-normal)" }],
      micro: ["var(--t-micro)", { lineHeight: "var(--lh-normal)" }],
    },
    fontWeight: {
      reg: "var(--w-reg)",
      med: "var(--w-med)",
      semi: "var(--w-semi)",
    },
    lineHeight: {
      tight: "var(--lh-tight)",
      snug: "var(--lh-snug)",
      normal: "var(--lh-normal)",
    },
    transitionDuration: {
      DEFAULT: "var(--dur-press)",
      press: "var(--dur-press)",
      tooltip: "var(--dur-tooltip)",
      dropdown: "var(--dur-dropdown)",
      modal: "var(--dur-modal)",
    },
    transitionTimingFunction: {
      DEFAULT: "var(--ease-out)",
      out: "var(--ease-out)",
      "in-out": "var(--ease-in-out)",
      drawer: "var(--ease-drawer)",
    },
    extend: {
      minHeight: { touch: "var(--touch)" },
      minWidth: { touch: "var(--touch)" },
      scale: { press: "var(--press-scale)" },
      keyframes: {
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "sheet-in": "sheet-in var(--dur-modal) var(--ease-drawer)",
        "fade-in": "fade-in var(--dur-modal) var(--ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
