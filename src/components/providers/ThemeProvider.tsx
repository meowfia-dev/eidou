import React, { useEffect } from 'react';
import { toRgbChannels } from '../../lib/utils';

interface ThemeColors {
  bg?: string;
  surface?: string;
  text?: string;
  primary?: string;
  primaryDim?: string;  // v2: Dark Olive for structure
  primaryBright?: string;  // v3: Bright green for hover/active
  border?: string;
  [key: string]: string | undefined;
}

interface ThemeRadii {
  base?: string;
  [key: string]: string | undefined;
}

interface ThemeLegacyTokens {
  primary?: string;
  bg?: string;
  text?: string;
  radius?: string;
  border?: string;
  [key: string]: string | undefined;
}

/**
 * Transition timing overrides for a single variant.
 * Theme hosts can override core durations and provide custom Seed label pools.
 *
 * @see /docs/rfc/004-materialization-protocol.md Section 9.1
 */
export interface TransitionDefinition {
  /** Override the Seed label pool for this variant. */
  seed_labels?: string[];
  enter?: {
    /** Enter animation duration in ms. */
    duration?: number;
  };
  exit?: {
    /** Exit animation duration in ms. */
    duration?: number;
  };
  reveal?: {
    /** Reveal (clip-path expansion) animation duration in ms. */
    duration?: number;
  };
}

export interface Theme {
  mode?: "dark" | "light" | string;
  colors?: ThemeColors;
  radii?: ThemeRadii;
  tokens?: ThemeLegacyTokens;
  /**
   * Transition definitions keyed by variant name (e.g., "default", "glitch").
   * Overrides core animation timing and Seed label pools.
   *
   * @see /docs/rfc/004-materialization-protocol.md Section 9
   */
  transitions?: Record<string, TransitionDefinition>;
}

interface ThemeProviderProps {
  theme?: Theme;
  children: React.ReactNode;
}

const CSS_VAR_MAP = {
  bg: '--eidou-color-bg-rgb',
  surface: '--eidou-color-surface-rgb',
  text: '--eidou-color-text-rgb',
  primary: '--eidou-color-primary-rgb',
  primaryDim: '--eidou-color-primary-dim-rgb',  // v2
  primaryBright: '--eidou-color-primary-bright-rgb',  // v3
  border: '--eidou-color-border-rgb',
};

const RADIUS_VAR = '--eidou-radius-base';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children }) => {
  useEffect(() => {
    const doc = document.documentElement;
    const style = doc.style;

    // Helper to set or remove rgb var.
    // If color is invalid or missing, we remove the inline style so CSS defaults apply.
    const setRgbVar = (varName: string, color: string | undefined) => {
      if (color) {
        const channels = toRgbChannels(color);
        if (channels) {
          style.setProperty(varName, channels);
          return;
        }
      }
      style.removeProperty(varName);
    };

    // Helper for raw string vars (radii).
    const setRawVar = (varName: string, value: string | undefined) => {
      if (value) {
        style.setProperty(varName, value);
      } else {
        style.removeProperty(varName);
      }
    };

    // 1. Mode Switching
    if (theme?.mode === 'light') {
      doc.setAttribute('data-eidou-theme', 'light');
    } else {
      doc.removeAttribute('data-eidou-theme');
    }

    // 2. Resolution rules
    // - V2 (colors/radii): only explicitly provided keys override CSS defaults.
    // - Legacy tokens: supported only when V2 colors/radii are not provided.
    const useLegacyTokens = Boolean(theme?.tokens) && !theme?.colors && !theme?.radii;
    const colors = theme?.colors;
    const tokens = theme?.tokens;

    // V2 colors: no implicit fallbacks (e.g., surface <- bg is NOT allowed).
    const v2Bg = colors?.bg;
    const v2Surface = colors?.surface;
    const v2Text = colors?.text;
    const v2Primary = colors?.primary;
    const v2PrimaryDim = colors?.primaryDim;  // v2
    const v2PrimaryBright = colors?.primaryBright;
    const v2Border = colors?.border;

    // Legacy tokens mapping (only if useLegacyTokens)
    const legacyBg = useLegacyTokens ? tokens?.bg : undefined;
    const legacySurface = useLegacyTokens ? tokens?.bg : undefined;
    const legacyText = useLegacyTokens ? tokens?.text : undefined;
    const legacyPrimary = useLegacyTokens ? tokens?.primary : undefined;
    const legacyBorder = useLegacyTokens ? (tokens?.border ?? tokens?.primary) : undefined;
    const legacyRadius = useLegacyTokens ? tokens?.radius : undefined;

    const bg = v2Bg ?? legacyBg;
    const surface = v2Surface ?? legacySurface;
    const text = v2Text ?? legacyText;
    const primary = v2Primary ?? legacyPrimary;
    const primaryDim = v2PrimaryDim;  // v2: no legacy fallback
    const primaryBright = v2PrimaryBright;  // v3: no legacy fallback
    const border = v2Border ?? legacyBorder;

    const radius = colors || theme?.radii ? theme?.radii?.base : legacyRadius;

    // 3. Apply Vars
    setRgbVar(CSS_VAR_MAP.bg, bg);
    setRgbVar(CSS_VAR_MAP.surface, surface);
    setRgbVar(CSS_VAR_MAP.text, text);
    setRgbVar(CSS_VAR_MAP.primary, primary);
    setRgbVar(CSS_VAR_MAP.primaryDim, primaryDim);  // v2
    setRgbVar(CSS_VAR_MAP.primaryBright, primaryBright);  // v3
    setRgbVar(CSS_VAR_MAP.border, border);
    
    setRawVar(RADIUS_VAR, radius);

    // Cleanup on unmount or change
    return () => {
      doc.removeAttribute('data-eidou-theme');
      Object.values(CSS_VAR_MAP).forEach(v => style.removeProperty(v));
      style.removeProperty(RADIUS_VAR);
    };
  }, [theme]);

  // Render children directly (fragment)
  return <>{children}</>;
};
