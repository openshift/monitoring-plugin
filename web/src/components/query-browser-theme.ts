import { ChartThemeColor, ChartThemeDefinition, getCustomTheme } from '@patternfly/react-charts';
import { global_palette_black_300 as globalBlack300 } from '@patternfly/react-tokens/dist/esm/global_palette_black_300';

const pfDependentAxisTickLabels: Record<string, string | number> = {
  padding: 5,
  fontFamily: 'var(--pf-v5-chart-global--FontFamily)',
  letterSpacing: 'var(--pf-v5-chart-global--letter-spacing)',
  fill: 'var(--pf-v5-global--Color--200)',
};

const theme: ChartThemeDefinition = {
  chart: {
    padding: {
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
    },
  },
  dependentAxis: {
    style: {
      axis: {
        stroke: 'none',
      },
      grid: {
        stroke: '#EDEDED',
      },
      tickLabels: pfDependentAxisTickLabels,
    },
  },
  independentAxis: {
    style: {
      ticks: {
        size: 5,
        strokeWidth: '1',
        stroke: globalBlack300.value,
      },
      tickLabels: Object.assign({}, pfDependentAxisTickLabels, { padding: 2 }),
      grid: {
        stroke: 'none',
      },
    },
  },
  line: {
    style: {
      data: {
        opacity: 0.75,
      },
    },
  },
};

export const queryBrowserTheme = getCustomTheme(ChartThemeColor.multiOrdered, theme);
