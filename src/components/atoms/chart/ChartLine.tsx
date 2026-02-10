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
      areaOpacity={0.15}
      yScale={{ type: 'linear', stacked: stacked ?? false }}
      curve="monotoneX"
      lineWidth={2}
      margin={{
        top: 20,
        right: resolvedShowLegend ? 120 : 20,
        bottom: xLabel ? 50 : 40,
        left: yLabel ? 60 : 50,
      }}
      axisBottom={{
        tickSize: 5,
        tickPadding: 5,
        tickRotation: 0,
        ...(xLabel
          ? {
              legend: xLabel,
              legendOffset: 36,
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
              legendOffset: -50,
              legendPosition: 'middle',
            }
          : {}),
      }}
      enableGridX={showGrid}
      enableGridY={showGrid}
      enablePoints
      pointSize={6}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointColor="var(--card)"
      useMesh
      isInteractive={showTooltip}
      animate={animate}
      enableSlices={false}
      legends={
        resolvedShowLegend
          ? [
              {
                anchor: 'bottom-right',
                direction: 'column',
                translateX: 110,
                itemWidth: 100,
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
