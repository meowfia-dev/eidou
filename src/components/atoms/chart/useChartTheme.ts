import { useMemo } from 'react';
import type { PartialTheme } from '@nivo/theming';

// V4 Tactical Terminal: neon green primary, cool-tone complements
const TACTICAL_COLORS = [
  '#7CFF00',
  '#00D4AA',
  '#00B8E6',
  '#A0E000',
  '#60D0F0',
];

// Eidou design system resolved colors (from --eidou-color-*-rgb in index.css).
// Nivo theme applies these as SVG inline styles where CSS vars resolve correctly,
// but we use the native var() syntax so theme overrides (e.g. light mode) propagate.
const TEXT_COLOR = 'rgb(var(--eidou-color-text-rgb))';
const TEXT_COLOR_DIM = 'rgb(var(--eidou-color-text-rgb) / 0.8)';
const TEXT_COLOR_MUTED = 'rgb(var(--eidou-color-text-rgb) / 0.7)';
const BORDER_COLOR = 'rgb(var(--eidou-color-border-rgb))';
const BORDER_COLOR_DIM = 'rgb(var(--eidou-color-border-rgb) / 0.5)';
const SURFACE_COLOR = 'rgb(var(--eidou-color-surface-rgb))';

export function useChartTheme(customColors?: string[]): {
  theme: PartialTheme;
  colors: string[];
} {
  return useMemo(() => {
    const colors = customColors && customColors.length > 0 ? customColors : TACTICAL_COLORS;

    const theme: PartialTheme = {
      text: {
        fontSize: 11,
        fill: TEXT_COLOR,
        fontFamily: 'var(--font-mono)',
      },
      axis: {
        domain: { line: { stroke: BORDER_COLOR, strokeWidth: 1 } },
        ticks: {
          line: { stroke: BORDER_COLOR, strokeWidth: 1 },
          text: { fill: TEXT_COLOR_DIM, fontSize: 11 },
        },
        legend: { text: { fill: TEXT_COLOR, fontSize: 11, fontWeight: 600 } },
      },
      grid: {
        line: { stroke: BORDER_COLOR_DIM, strokeWidth: 1, strokeDasharray: '3 4' },
      },
      legends: {
        text: { fill: TEXT_COLOR_MUTED, fontSize: 11 },
      },
      tooltip: {
        container: {
          background: SURFACE_COLOR,
          border: `1px solid ${BORDER_COLOR}`,
          borderRadius: '0px',
          fontSize: 11,
          color: TEXT_COLOR,
          fontFamily: 'var(--font-mono)',
        },
      },
    };

    return { theme, colors };
  }, [customColors]);
}
