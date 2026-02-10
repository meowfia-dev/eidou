import { ResponsiveBar } from '@nivo/bar';
import type { PartialTheme } from '@nivo/theming';
import type { ChartBarDatum } from './useChartData';

interface ChartBarProps {
  data: ChartBarDatum[];
  keys: string[];
  indexBy: string;
  theme: PartialTheme;
  colors: string[];
  stacked?: boolean;
  horizontal?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  xLabel?: string;
  yLabel?: string;
}

export function ChartBar({
  data,
  keys,
  indexBy,
  theme,
  colors,
  stacked,
  horizontal,
  showGrid = true,
  showLegend,
  showTooltip = true,
  animate = true,
  xLabel,
  yLabel,
}: ChartBarProps) {
  const resolvedShowLegend = showLegend ?? keys.length > 1;
  const bottomLabel = horizontal ? yLabel : xLabel;
  const leftLabel = horizontal ? xLabel : yLabel;

  return (
    <ResponsiveBar<ChartBarDatum>
      data={data}
      keys={keys}
      indexBy={indexBy}
      theme={theme}
      colors={colors}
      groupMode={stacked ? 'stacked' : 'grouped'}
      layout={horizontal ? 'horizontal' : 'vertical'}
      margin={{
        top: 20,
        right: 20,
        bottom: resolvedShowLegend ? 70 : (bottomLabel ? 55 : 45),
        left: leftLabel ? 65 : 55,
      }}
      padding={0.3}
      borderRadius={0}
      borderWidth={1}
      borderColor={{ from: 'color', modifiers: [['darker', 0.6]] }}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        ...(bottomLabel
          ? {
              legend: bottomLabel,
              legendOffset: 40,
              legendPosition: 'middle',
            }
          : {}),
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        ...(leftLabel
          ? {
              legend: leftLabel,
              legendOffset: -55,
              legendPosition: 'middle',
            }
          : {}),
      }}
      enableGridX={horizontal ? showGrid : false}
      enableGridY={horizontal ? false : showGrid}
      isInteractive={showTooltip}
      animate={animate}
      labelSkipWidth={12}
      labelSkipHeight={12}
      labelTextColor="#000000"
      legends={
        resolvedShowLegend
          ? [
              {
                anchor: 'bottom',
                dataFrom: 'keys',
                direction: 'row',
                translateY: 60,
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
