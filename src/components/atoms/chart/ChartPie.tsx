import { ResponsivePie } from '@nivo/pie';
import type { PartialTheme } from '@nivo/theming';
import type { PieDatum } from './useChartData';

interface ChartPieProps {
  data: PieDatum[];
  theme: PartialTheme;
  colors: string[];
  donut?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
}

export function ChartPie({
  data,
  theme,
  colors,
  donut,
  showLegend = true,
  showTooltip = true,
  animate = true,
}: ChartPieProps) {
  return (
    <ResponsivePie<PieDatum>
      data={data}
      theme={theme}
      colors={colors}
      innerRadius={donut ? 0.5 : 0}
      padAngle={1}
      cornerRadius={0}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
      margin={{ top: 20, right: showLegend ? 120 : 20, bottom: 20, left: 20 }}
      enableArcLinkLabels
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor="var(--foreground)"
      arcLinkLabelsThickness={1}
      arcLinkLabelsColor={{ from: 'color' }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
      isInteractive={showTooltip}
      animate={animate}
      legends={
        showLegend
          ? [
              {
                anchor: 'right',
                direction: 'column',
                translateX: 100,
                itemWidth: 90,
                itemHeight: 20,
                symbolSize: 10,
                symbolShape: 'square',
              },
            ]
          : undefined
      }
    />
  );
}
