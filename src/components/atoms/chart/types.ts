import type { UniversalStyleProps } from '../../../lib/euip';

export type ChartVariant = 'line' | 'bar' | 'pie' | 'area';

export interface ChartProps extends UniversalStyleProps {
  variant: ChartVariant;
  data: Record<string, string | number>[];
  xKey?: string;
  series?: string[];
  stacked?: boolean;
  horizontal?: boolean;
  xLabel?: string;
  yLabel?: string;
  labelKey?: string;
  valueKey?: string;
  donut?: boolean;
  height?: number | string;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
}
