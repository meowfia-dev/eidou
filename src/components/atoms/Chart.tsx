import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import type { ChartProps } from './chart/types';
import { ChartBar } from './chart/ChartBar';
import { ChartLine } from './chart/ChartLine';
import { ChartPie } from './chart/ChartPie';
import { useChartData } from './chart/useChartData';
import { useChartTheme } from './chart/useChartTheme';

type ChartComponentProps = ChartProps & { className?: string };

export const Chart = forwardRef<HTMLDivElement, ChartComponentProps>((props, ref) => {
  const {
    variant,
    data,
    xKey,
    series,
    labelKey,
    valueKey,
    stacked,
    horizontal,
    donut,
    xLabel,
    yLabel,
    height = 300,
    colors: customColors,
    showLegend,
    showGrid,
    showTooltip,
    animate,
    _style,
    className,
  } = props;

  const nivoData = useChartData({ variant, data, xKey, series, labelKey, valueKey });
  const { theme, colors } = useChartTheme(customColors);
  const heightStyle = typeof height === 'number' ? `${height}px` : height;
  const style = { height: heightStyle, ...(_style as CSSProperties) };

  if (nivoData.isEmpty) {
    return (
      <div ref={ref} className={cn('w-full flex items-center justify-center', className)} style={style}>
        <span className="font-mono text-sm text-foreground/40">No data</span>
      </div>
    );
  }

  const renderChart = () => {
    switch (nivoData.variant) {
      case 'line':
      case 'area':
        return (
          <ChartLine
            series={nivoData.series}
            theme={theme}
            colors={colors}
            enableArea={nivoData.variant === 'area'}
            stacked={stacked}
            showGrid={showGrid}
            showLegend={showLegend}
            showTooltip={showTooltip}
            animate={animate}
            xLabel={xLabel}
            yLabel={yLabel}
          />
        );
      case 'bar':
        return (
          <ChartBar
            data={nivoData.data}
            keys={nivoData.keys}
            indexBy={nivoData.indexBy}
            theme={theme}
            colors={colors}
            stacked={stacked}
            horizontal={horizontal}
            showGrid={showGrid}
            showLegend={showLegend}
            showTooltip={showTooltip}
            animate={animate}
            xLabel={xLabel}
            yLabel={yLabel}
          />
        );
      case 'pie':
        return (
          <ChartPie
            data={nivoData.data}
            theme={theme}
            colors={colors}
            donut={donut}
            showLegend={showLegend}
            showTooltip={showTooltip}
            animate={animate}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div ref={ref} className={cn('w-full', className)} style={style}>
      {renderChart()}
    </div>
  );
});

Chart.displayName = 'Chart';
