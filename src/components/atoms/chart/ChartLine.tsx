import { ResponsiveLine } from '@nivo/line';
import type { LineSeries } from '@nivo/line';
import type { PartialTheme } from '@nivo/theming';

interface ChartLineProps {
  series: LineSeries[];
  theme: PartialTheme;
  colors: string[];
  enableArea?: boolean;
  stacked?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  xLabel?: string;
  yLabel?: string;
}

export function ChartLine({
  series,
  theme,
  colors,
  enableArea = false,
  stacked,
  showGrid = true,
  showLegend,
  showTooltip = true,
  animate = true,
  xLabel,
  yLabel,
}: ChartLineProps) {
  const resolvedShowLegend = showLegend ?? series.length > 1;

  return (
    <ResponsiveLine
      data={series}
      theme={theme}
      colors={colors}
      enableArea={enableArea}
      areaOpacity={0.3}
      yScale={{ type: 'linear', stacked: stacked ?? false }}
      curve="monotoneX"
      lineWidth={2}
      margin={{
        top: 20,
        right: 20,
        bottom: resolvedShowLegend ? 70 : (xLabel ? 55 : 45),
        left: yLabel ? 65 : 55,
      }}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        ...(xLabel
          ? {
              legend: xLabel,
              legendOffset: 40,
              legendPosition: 'middle',
            }
          : {}),
      }}
      axisLeft={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        ...(yLabel
          ? {
              legend: yLabel,
              legendOffset: -55,
              legendPosition: 'middle',
            }
          : {}),
      }}
      enableGridX={showGrid}
      enableGridY={showGrid}
      enablePoints
      pointSize={8}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointColor="#CBD5E1"
      useMesh
      isInteractive={showTooltip}
      animate={animate}
      enableSlices={false}
      legends={
        resolvedShowLegend
          ? [
              {
                anchor: 'bottom',
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
