/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    // Spacing
    { pattern: /^(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml)-(0|1|2|3|4|5|6|8|10|12|16)$/ },
    // Gap
    { pattern: /^gap-(0|1|2|3|4|6|8)$/ },
    // Background colors (v4: added void-pure)
    { 
      pattern: /^bg-(transparent|card|primary|primary-bright|primary-dim|foreground|muted|danger|info|success|warning|elevated|divider|void-pure)(\/(10|20|40|60|80|100))?$/ 
    },
    // Text colors (v3: added primary-bright)
    { 
      pattern: /^text-(primary|primary-bright|primary-dim|foreground|muted|danger|info|success|warning|text-body|text-muted|text-dim)(\/(10|20|40|60|80|100))?$/ 
    },
    // Border colors (v3: added primary-bright)
    { 
      pattern: /^border-(primary|primary-bright|primary-dim|foreground|muted|danger|info|success|warning|border)(\/(10|20|40|60|80|100))?$/ 
    },
    // Radius
    { pattern: /^rounded-(none|sm|base|md|lg|full)$/ },
    // Shadows (v4: shadow-float is now glow-based)
    { pattern: /^shadow-(none|neon-dim|neon-sm|neon|neon-lg|neon-xl|float|danger-glow|warning-glow|info-glow|screen)$/ },
    // Typography (v4: added xxs, display)
    { pattern: /^text-(xxs|xs|sm|base|lg|xl|2xl|3xl|display)$/ },
    { pattern: /^font-(normal|medium|semibold|bold)$/ },
    { pattern: /^tracking-(normal|wide|wider|widest)$/ },
    // Layout
    { pattern: /^items-(start|center|end|stretch)$/ },
    { pattern: /^justify-(start|center|end|between|around)$/ },
    { pattern: /^animate-(scan|scan-indeterminate|glitch|blink|appear|flicker|pulse-glow)$/ },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-body)",
        mono: "var(--font-mono)",
        heading: "var(--font-heading)",
      },
      fontSize: {
        // v4: decorative + HUD sizes with per-size tracking
        xxs: ["10px", { lineHeight: "14px", letterSpacing: "0.1em" }],
        display: ["40px", { lineHeight: "1", letterSpacing: "-0.05em" }],
      },
      colors: {
        // === THEMEABLE CORE (ThemeProvider controls these) ===
        background: "transparent",
        card: "rgb(var(--eidou-color-surface-rgb) / <alpha-value>)",
        primary: "rgb(var(--eidou-color-primary-rgb) / <alpha-value>)",
        "primary-dim": "rgb(var(--eidou-color-primary-dim-rgb) / <alpha-value>)",
        "primary-bright": "rgb(var(--eidou-color-primary-bright-rgb) / <alpha-value>)",
        "primary-foreground": "rgb(var(--eidou-color-primary-foreground-rgb) / <alpha-value>)",
        foreground: "rgb(var(--eidou-color-text-rgb) / <alpha-value>)",
        border: "rgb(var(--eidou-color-border-rgb) / <alpha-value>)",
        // === EXTENDED SLATE TEXT ===
        "text-body": "rgb(var(--eidou-color-text-body-rgb) / <alpha-value>)",
        "text-muted": "rgb(var(--eidou-color-text-muted-rgb) / <alpha-value>)",
        "text-dim": "rgb(var(--eidou-color-text-dim-rgb) / <alpha-value>)",
        // === EXTENDED SURFACES ===
        elevated: "rgb(var(--eidou-color-elevated-rgb) / <alpha-value>)",
        divider: "rgb(var(--eidou-color-divider-rgb) / <alpha-value>)",
        "void-pure": "rgb(var(--eidou-color-void-pure-rgb) / <alpha-value>)",
        // === SEMANTIC COLORS (fixed) ===
        muted: "rgb(var(--eidou-color-muted-rgb) / <alpha-value>)",
        overlay: "rgb(var(--eidou-color-overlay-rgb) / <alpha-value>)",
        thumb: "rgb(var(--eidou-color-thumb-rgb) / <alpha-value>)",
        info: "rgb(var(--eidou-color-info-rgb) / <alpha-value>)",
        success: "rgb(var(--eidou-color-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--eidou-color-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--eidou-color-danger-rgb) / <alpha-value>)",
        "danger-foreground": "rgb(var(--eidou-color-danger-foreground-rgb) / <alpha-value>)",
      },
      // === STRUCTURAL: BORDER RADIUS SCALE ===
      borderRadius: {
        none: "var(--eidou-radius-none)",
        sm: "var(--eidou-radius-sm)",
        base: "var(--eidou-radius-base)",
        md: "var(--eidou-radius-md)",
        lg: "var(--eidou-radius-lg)",
        full: "var(--eidou-radius-full)",
      },
      // === STRUCTURAL: SHADOW SCALE (v2 Dual-Tone) ===
      boxShadow: {
        // Subtle glow (olive) - comfortable for focus/hover
        "neon-dim": "var(--eidou-glow-dim)",
        "neon-sm": "var(--eidou-glow-sm)",
        neon: "var(--eidou-glow-md)",
        // Emphasis glow (cyber green) - use sparingly
        "neon-lg": "var(--eidou-glow-lg)",
        "neon-xl": "var(--eidou-glow-xl)",
        // Semantic glow
        "danger-glow": "var(--eidou-glow-danger)",
        "warning-glow": "var(--eidou-glow-warning)",
        "info-glow": "var(--eidou-glow-info)",
        screen: "var(--eidou-glow-screen)",
        // Elevation (glow-based, no black shadows)
        float: "0 4px 12px -2px rgb(var(--eidou-color-primary-dim-rgb) / 0.3), 0 0 8px rgb(var(--eidou-color-primary-dim-rgb) / 0.2)",
      },
      dropShadow: {
        neon: "0 0 10px rgb(var(--eidou-color-primary-rgb))",
        "neon-sm": "0 0 5px rgb(var(--eidou-color-primary-rgb))",
      },
      // === KEYFRAMES ===
      keyframes: {
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "scan-indeterminate": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        appear: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "33%": { opacity: "0.95" },
          "66%": { opacity: "0.98" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "var(--eidou-glow-dim)" },
          "50%": { boxShadow: "var(--eidou-glow-md)" },
        },
      },
      animation: {
        scan: "scan 2s linear infinite",
        "scan-indeterminate": "scan-indeterminate 2s linear infinite",
        blink: "blink 1s step-end infinite",
        appear: "appear 0.2s ease-out",
        flicker: "flicker 0.3s infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}
