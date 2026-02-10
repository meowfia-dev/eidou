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
      margin={{
        top: 20,
        right: 20,
        bottom: showLegend ? 60 : 20,
        left: 20,
      }}
      enableArcLinkLabels
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor="var(--foreground)"
      arcLinkLabelsThickness={1}
      arcLinkLabelsColor={{ from: 'color' }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor="#000000"
      isInteractive={showTooltip}
      animate={animate}
      legends={
        showLegend
          ? [
              {
                anchor: 'bottom',
                direction: 'row',
                translateY: 50,
                itemWidth: 100,
                itemHeight: 18,
                symbolSize: 12,
                symbolShape: 'square',
                itemsSpacing: 4,
              },
            ]
          : undefined
      }
    />
  );
}
