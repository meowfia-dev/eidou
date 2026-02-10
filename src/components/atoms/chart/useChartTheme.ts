import { useMemo } from 'react';
import type { PartialTheme } from '@nivo/theming';

const TACTICAL_COLORS = [
  '#7CFF00',
  '#00E5FF',
  '#FF6B35',
  '#B388FF',
  '#FFD600',
  '#FF1744',
  '#18FFFF',
  '#76FF03',
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
          text: { fill: 'var(--foreground)', fontSize: 10, opacity: 0.6 },
        },
        legend: { text: { fill: 'var(--foreground)', fontSize: 11 } },
      },
      grid: {
        line: { stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '2 4', opacity: 0.3 },
      },
      legends: {
        text: { fill: 'var(--foreground)', fontSize: 10 },
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
