import { ChartThemeDefinition } from '@patternfly/react-charts/victory';
import { ChartThemeColor, getCustomTheme } from '@patternfly/react-charts/victory';
import {
  chart_axis_grid_stroke_Color,
  chart_axis_tick_Size,
  chart_axis_tick_stroke_Color,
  chart_axis_tick_Width,
  chart_global_FontFamily,
  chart_axis_tick_label_Fill,
  chart_global_letter_spacing,
  chart_line_data_Opacity,
} from '@patternfly/react-tokens';

const pfDependentAxisTickLabels: Record<string, string | number> = {
  padding: 4, // --pf-t-global--spacer-xs
  fontFamily: chart_global_FontFamily.var,
  letterSpacing: chart_global_letter_spacing.var,
  fill: chart_axis_tick_label_Fill.var,
};

const theme: ChartThemeDefinition = {
  chart: {
    padding: {
      bottom: 24, // --pf-t--global--spacer--lg
      left: 64, //--pf-t--global--spacer--3xl
      right: 16, //--pf-t--global--spacer--md
      top: 4, //--pf-t--global--spacer--xs
    },
  },
  dependentAxis: {
    style: {
      axis: {
        stroke: 'none',
      },
      grid: {
        stroke: chart_axis_grid_stroke_Color.var,
      },
      tickLabels: pfDependentAxisTickLabels,
    },
  },
  independentAxis: {
    style: {
      ticks: {
        size: chart_axis_tick_Size.value,
        strokeWidth: chart_axis_tick_Width.value,
        stroke: chart_axis_tick_stroke_Color.value,
      },
      tickLabels: pfDependentAxisTickLabels,
      grid: {
        stroke: 'none',
      },
    },
  },
  line: {
    style: {
      data: {
        opacity: chart_line_data_Opacity.value,
      },
    },
  },
};

export const queryBrowserTheme = getCustomTheme(ChartThemeColor.multiOrdered, theme);
