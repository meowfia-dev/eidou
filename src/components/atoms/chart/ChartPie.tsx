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
        top: 10,
        right: 10,
        bottom: showLegend ? 80 : 10,
        left: 10,
      }}
      enableArcLinkLabels={false}
      enableArcLabels={false}
      isInteractive={showTooltip}
      animate={animate}
      legends={
        showLegend
          ? [
              {
                anchor: 'bottom',
                direction: 'row',
                translateY: 65,
                itemWidth: 85,
                itemHeight: 18,
                symbolSize: 10,
                symbolShape: 'square',
                itemsSpacing: 4,
              },
            ]
          : undefined
      }
    />
  );
}
