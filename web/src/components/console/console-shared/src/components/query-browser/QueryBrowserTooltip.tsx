import * as React from 'react';
import * as _ from 'lodash-es';

import { VictoryPortal } from 'victory';
import classNames from 'classnames';
import { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import withFallback from '../../../error/fallbacks/withFallback';
import { formatNumber } from '../../../../../format';
import { humanizeNumberSI } from '../../../../utils/units';
import { dateTimeFormatterWithSeconds } from '../../../../utils/datetime';

const TOOLTIP_MAX_ENTRIES = 20;
const TOOLTIP_MAX_WIDTH = 400;
const TOOLTIP_MAX_HEIGHT = 400;
const TOOLTIP_MAX_LEFT_JUT_OUT = 85;
const TOOLTIP_MAX_RIGHT_JUT_OUT = 45;

type TooltipSeries = {
  color: string;
  labels: PrometheusLabels;
  name: string;
  key: string;
  total: number;
  value: string;
};

// Use exponential notation for small or very large numbers to avoid labels with too many characters
const formatPositiveValue = (v: number): string =>
  v === 0 || (0.001 <= v && v < 1e23) ? humanizeNumberSI(v).string : v.toExponential(1);

const formatValue = (v: number): string => (v < 0 ? '-' : '') + formatPositiveValue(Math.abs(v));

export const valueFormatter = (units: string): ((v: number) => string) =>
  ['ms', 's', 'bytes', 'Bps', 'pps'].includes(units)
    ? (v: number) => formatNumber(String(v), undefined, units)
    : formatValue;

// For performance, use this instead of PatternFly's ChartTooltip or Victory VictoryTooltip
const QueryBrowserTooltipWrapped: React.FC<TooltipProps> = ({
  activePoints,
  center,
  height,
  style,
  width,
  x,
}) => {
  const time = activePoints?.[0]?.x;

  if (!_.isDate(time) || !_.isFinite(x)) {
    return null;
  }

  // Don't show the tooltip if the cursor is too far from the active points (can happen when the
  // graph's timespan includes a range with no data)
  if (Math.abs(x - center.x) > width / 15) {
    return null;
  }

  // Pick tooltip width and location (left or right of the cursor) to maximize its available space
  const spaceOnLeft = x + TOOLTIP_MAX_LEFT_JUT_OUT;
  const spaceOnRight = width - x + TOOLTIP_MAX_RIGHT_JUT_OUT;
  const isOnLeft = spaceOnLeft > spaceOnRight;
  const tooltipMaxWidth = Math.min(isOnLeft ? spaceOnLeft : spaceOnRight, TOOLTIP_MAX_WIDTH);

  // Sort the entries in the tooltip from largest to smallest (to match the position of points in
  // the graph) and limit to the maximum number we can display. There could be a large number of
  // points, so we use a slightly less succinct approach to avoid sorting the whole list of points
  // and to avoid processing points that won't fit in the tooltip.
  const largestPoints: TooltipSeries[] = [];
  activePoints.forEach(({ _y1, y }, i) => {
    const total = _y1 ?? y;
    if (
      largestPoints.length < TOOLTIP_MAX_ENTRIES ||
      largestPoints[TOOLTIP_MAX_ENTRIES - 1].total < total
    ) {
      const point = {
        color: style[i]?.fill,
        key: String(i),
        labels: style[i]?.labels,
        name: style[i]?.name,
        total,
        value: valueFormatter(style[i]?.units)(y),
      };
      largestPoints.splice(
        _.sortedIndexBy(largestPoints, point, (p) => -p.total),
        0,
        point,
      );
    }
  });
  const allSeries: TooltipSeries[] = largestPoints.slice(0, TOOLTIP_MAX_ENTRIES);

  // For each series we are displaying in the tooltip, create a name based on its labels. We have
  // limited space, so sort the labels to try to show the most useful first since later labels will
  // likely be cut off. Sort first by the number of unique values for the label (prefer to show
  // labels with more values because they are more helpful in identifying the series), then by the
  // length of the label (prefer to show sorter labels because space is limited).
  const allSeriesSorted: string[] = _.sortBy(
    _.without(
      _.uniq(_.flatMap(allSeries, (s) => (s.labels ? Object.keys(s.labels) : []))),
      '__name__',
    ),
    [(k) => -_.uniq(allSeries.map((s) => s.labels[k])).length, (k) => k.length],
  );
  const getSeriesName = (series: TooltipSeries): string => {
    if (_.isString(series.name)) {
      return series.name;
    }
    if (_.isEmpty(series.labels)) {
      return '{}';
    }
    // eslint-disable-next-line no-underscore-dangle
    const name = series.labels.__name__ ?? '';
    const otherLabels = _.intersection(allSeriesSorted, Object.keys(series.labels));
    return `${name}{${otherLabels.map((l) => `${l}=${series.labels[l]}`).join(',')}}`;
  };

  return (
    <>
      <VictoryPortal>
        <foreignObject
          height={TOOLTIP_MAX_HEIGHT}
          width={tooltipMaxWidth}
          x={isOnLeft ? x - tooltipMaxWidth : x}
          y={center.y - TOOLTIP_MAX_HEIGHT / 2}
        >
          <div
            className={classNames('query-browser__tooltip-wrap', {
              'query-browser__tooltip-wrap--left': isOnLeft,
            })}
          >
            <div className="query-browser__tooltip-arrow" />
            <div className="query-browser__tooltip">
              <div className="query-browser__tooltip-time">
                {dateTimeFormatterWithSeconds.format(time)}
              </div>
              {allSeries.map((s) => (
                <div className="query-browser__tooltip-series" key={s.key}>
                  <div className="query-browser__series-btn" style={{ backgroundColor: s.color }} />
                  <div className="co-nowrap co-truncate">{getSeriesName(s)}</div>
                  <div className="query-browser__tooltip-value">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </foreignObject>
      </VictoryPortal>
      <line className="query-browser__tooltip-line" x1={x} x2={x} y1="0" y2={height} />
    </>
  );
};
export const QueryBrowserTooltip = withFallback(QueryBrowserTooltipWrapped);

type TooltipProps = {
  activePoints?: { x: number; y: number; _y1?: number }[];
  center?: { x: number; y: number };
  height?: number;
  style?: { fill: string; labels: PrometheusLabels; name: string; units: string };
  width?: number;
  x?: number;
};
