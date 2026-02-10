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

export function useChartTheme(customColors?: string[]): {
  theme: PartialTheme;
  colors: string[];
} {
  return useMemo(() => {
    const colors = customColors && customColors.length > 0 ? customColors : TACTICAL_COLORS;

    const theme: PartialTheme = {
      text: {
        fontSize: 11,
        fill: 'var(--foreground)',
        fontFamily: 'var(--font-mono)',
      },
      axis: {
        domain: { line: { stroke: 'var(--border)', strokeWidth: 1 } },
        ticks: {
          line: { stroke: 'var(--border)', strokeWidth: 1 },
          text: { fill: 'var(--foreground)', fontSize: 11, opacity: 0.8 },
        },
        legend: { text: { fill: 'var(--foreground)', fontSize: 11, fontWeight: 600 } },
      },
      grid: {
        line: { stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 4', opacity: 0.5 },
      },
      legends: {
        text: { fill: 'var(--foreground)', fontSize: 11 },
      },
      tooltip: {
        container: {
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '0px',
          fontSize: 11,
          color: 'var(--foreground)',
          fontFamily: 'var(--font-mono)',
        },
      },
    };

    return { theme, colors };
  }, [customColors]);
}
