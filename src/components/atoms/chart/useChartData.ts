import { useMemo } from 'react';
import type { BarDatum } from '@nivo/bar';
import type { LineSeries } from '@nivo/line';
import type { ChartVariant } from './types';

const FALLBACK_INDEX_KEY = '__index';

export type ChartDataRow = Record<string, string | number>;

export interface PieDatum {
  id: string | number;
  value: number;
  [key: string]: unknown;
}

export interface LineChartData {
  variant: 'line' | 'area';
  series: LineSeries[];
  isEmpty: boolean;
}

export type ChartBarDatum = BarDatum & ChartDataRow;

export interface BarChartData {
  variant: 'bar';
  data: ChartBarDatum[];
  keys: string[];
  indexBy: string;
  isEmpty: boolean;
}

export interface PieChartData {
  variant: 'pie';
  data: PieDatum[];
  isEmpty: boolean;
}

export type NivoChartData = LineChartData | BarChartData | PieChartData;

function getCellValue(row: ChartDataRow, key: string): string | number | undefined {
  return Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined;
}

function getStringKey(keys: string[], rows: ChartDataRow[]): string | undefined {
  for (const key of keys) {
    for (const row of rows) {
      if (typeof getCellValue(row, key) === 'string') {
        return key;
      }
    }
  }

  return undefined;
}

function getNumericKeys(keys: string[], rows: ChartDataRow[]): string[] {
  const numericKeys: string[] = [];

  for (const key of keys) {
    for (const row of rows) {
      if (typeof getCellValue(row, key) === 'number') {
        numericKeys.push(key);
        break;
      }
    }
  }

  return numericKeys;
}

function getAllKeys(rows: ChartDataRow[]): string[] {
  const keySet = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }

  return Array.from(keySet);
}

function toNumber(value: string | number | undefined): number {
  return typeof value === 'number' ? value : 0;
}

function toLabel(value: string | number | undefined): string | number {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return '';
}

interface UseChartDataParams {
  variant: ChartVariant;
  data: ChartDataRow[];
  xKey?: string;
  series?: string[];
  labelKey?: string;
  valueKey?: string;
}

export function useChartData(params: UseChartDataParams): NivoChartData {
  const { variant, data, xKey, series, labelKey, valueKey } = params;

  return useMemo(() => {
    if (data.length === 0) {
      if (variant === 'bar') {
        return {
          variant: 'bar',
          data: [],
          keys: [],
          indexBy: xKey ?? FALLBACK_INDEX_KEY,
          isEmpty: true,
        };
      }

      if (variant === 'pie') {
        return {
          variant: 'pie',
          data: [],
          isEmpty: true,
        };
      }

      return {
        variant,
        series: [],
        isEmpty: true,
      };
    }

    const allKeys = getAllKeys(data);
    const inferredStringKey = getStringKey(allKeys, data);
    const inferredNumericKeys = getNumericKeys(allKeys, data);

    if (variant === 'pie') {
      const resolvedLabelKey = labelKey ?? inferredStringKey ?? FALLBACK_INDEX_KEY;
      const resolvedValueKey = valueKey ?? inferredNumericKeys[0];

      if (!resolvedValueKey) {
        return {
          variant: 'pie',
          data: [],
          isEmpty: true,
        };
      }

      const pieData: PieDatum[] = data.map((row, index) => {
        const rawLabel =
          resolvedLabelKey === FALLBACK_INDEX_KEY
            ? index
            : getCellValue(row, resolvedLabelKey);

        return {
          id: toLabel(rawLabel),
          value: toNumber(getCellValue(row, resolvedValueKey)),
        };
      });

      return {
        variant: 'pie',
        data: pieData,
        isEmpty: pieData.length === 0,
      };
    }

    const resolvedXKey = xKey ?? inferredStringKey;
    const resolvedSeries =
      series && series.length > 0
        ? series
        : inferredNumericKeys.filter((key) => key !== resolvedXKey);

    if (variant === 'bar') {
      const indexBy = resolvedXKey ?? FALLBACK_INDEX_KEY;
      const normalizedData: ChartBarDatum[] = data.map((row, index) => {
        const mappedRow: ChartBarDatum = { ...row };

        if (indexBy === FALLBACK_INDEX_KEY) {
          mappedRow[indexBy] = index;
        } else {
          mappedRow[indexBy] = toLabel(getCellValue(row, indexBy));
        }

        for (const key of resolvedSeries) {
          mappedRow[key] = toNumber(getCellValue(row, key));
        }

        return mappedRow;
      });

      return {
        variant: 'bar',
        data: normalizedData,
        keys: resolvedSeries,
        indexBy,
        isEmpty: normalizedData.length === 0 || resolvedSeries.length === 0,
      };
    }

    const lineSeries: LineSeries[] = resolvedSeries.map((seriesKey) => ({
      id: seriesKey,
      data: data.map((row, index) => {
        const rawX =
          resolvedXKey === undefined ? index : getCellValue(row, resolvedXKey);

        return {
          x: toLabel(rawX),
          y: toNumber(getCellValue(row, seriesKey)),
        };
      }),
    }));

    return {
      variant,
      series: lineSeries,
      isEmpty: lineSeries.length === 0,
    };
  }, [variant, data, xKey, series, labelKey, valueKey]);
}
