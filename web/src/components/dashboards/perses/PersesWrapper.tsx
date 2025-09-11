import { ThemeOptions, ThemeProvider } from '@mui/material';
import { ChartThemeColor, getThemeColors } from '@patternfly/react-charts/victory';
import {
  ChartsProvider,
  generateChartsTheme,
  getTheme,
  PersesChartsTheme,
  SnackbarProvider,
  typography,
} from '@perses-dev/components';
import {
  BuiltinVariableDefinition,
  DashboardResource,
  Definition,
  DurationString,
  UnknownSpec,
} from '@perses-dev/core';
import {
  DashboardProvider,
  DatasourceStoreProvider,
  VariableProviderWithQueryParams,
} from '@perses-dev/dashboards';
import panelsResource from '@perses-dev/panels-plugin/plugin.json';
import {
  DataQueriesProvider,
  dynamicImportPluginLoader,
  PluginModuleResource,
  PluginRegistry,
  TimeRangeProviderWithQueryParams,
  useInitialRefreshInterval,
  useInitialTimeRange,
  usePluginBuiltinVariableDefinitions,
} from '@perses-dev/plugin-system';
import prometheusResource from '@perses-dev/prometheus-plugin/plugin.json';
import React, { useMemo } from 'react';
import { usePatternFlyTheme } from '../../hooks/usePatternflyTheme';
import { OcpDatasourceApi } from './datasource-api';
import { PERSES_PROXY_BASE_PATH, useFetchPersesDashboard } from './perses-client';
import { CachedDatasourceAPI } from './perses/datasource-api';
import {
  chart_color_blue_100,
  chart_color_blue_200,
  chart_color_blue_300,
  t_color_gray_95,
  t_color_white,
} from '@patternfly/react-tokens';
import { QueryParams } from '../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { useTranslation } from 'react-i18next';
import { LoadingBox } from '../../../components/console/console-shared/src/components/loading/LoadingBox';

// Override eChart defaults with PatternFly colors.
const patternflyBlue300 = '#2b9af3';
const patternflyBlue400 = '#0066cc';
const patternflyBlue500 = '#004080';
const patternflyBlue600 = '#002952';
const defaultPaletteColors = [patternflyBlue400, patternflyBlue500, patternflyBlue600];

const chartColorScale = getThemeColors(ChartThemeColor.multiUnordered).chart.colorScale;
const patternflyChartsMultiUnorderedPalette = Array.isArray(chartColorScale)
  ? chartColorScale.flatMap((cssColor) => {
      // colors stored as 'var(--pf-chart-theme--multi-color-unordered--ColorScale--3400, #73c5c5)'
      // need to extract the hex value, because fillStyle() of <canvas> does not support CSS vars
      const match = cssColor.match(/#[a-fA-F0-9]+/);
      return match ? [match[0]] : [];
    })
  : [];

// PluginRegistry configuration to allow access to
// visualization panels/charts (@perses-dev/panels-plugin)
// and data handlers for prometheus (@perses-dev/prometheus-plugin).
const pluginLoader = dynamicImportPluginLoader([
  {
    resource: panelsResource as PluginModuleResource,
    importPlugin: () => import('@perses-dev/panels-plugin'),
  },
  {
    resource: prometheusResource as PluginModuleResource,
    importPlugin: () => import('@perses-dev/prometheus-plugin'),
  },
]);

interface PersesWrapperProps {
  children?: React.ReactNode;
  project: string;
}

const mapPatterflyThemeToMUI = (theme: 'light' | 'dark'): ThemeOptions => {
  const isDark = theme === 'dark';
  const primaryTextColor = isDark ? t_color_white.value : t_color_gray_95.value;
  const primaryBackgroundColor = 'var(--pf-t--global--background--color--primary--default)';

  return {
    typography: {
      ...typography,
      fontFamily: 'var(--pf-t--global--font--family--body)',
      subtitle1: {
        // Card Heading
        fontFamily: 'var(--pf-t--global--font--family--heading)',
        fontWeight: 'var(--pf-t--global--font--weight--heading--default)',
        lineHeight: 'var(--pf-v6-c-card__title-text--LineHeight)',
        fontSize: 'var(--pf-t--global--font--size--heading--sm)',
      },
      h2: {
        // Panel Group Heading
        color: 'var(--pf-t--global--text--color--brand--default)',
        fontWeight: 'var(--pf-t--global--font--weight--body--default)',
        fontSize: 'var(--pf-t--global--font--size--600)',
      },
    },
    palette: {
      primary: {
        light: chart_color_blue_100.value,
        main: chart_color_blue_200.value,
        dark: chart_color_blue_300.value,
        contrastText: primaryTextColor,
      },
      secondary: {
        main: primaryTextColor,
        light: primaryTextColor,
        dark: primaryTextColor,
      },
      background: {
        default: primaryBackgroundColor,
        paper: primaryBackgroundColor,
        navigation: primaryBackgroundColor,
        code: primaryBackgroundColor,
        tooltip: primaryBackgroundColor,
        lighter: primaryBackgroundColor,
        border: primaryBackgroundColor,
      },
      text: {
        primary: primaryTextColor,
        secondary: primaryTextColor,
        disabled: primaryTextColor,
        navigation: primaryTextColor,
        accent: primaryTextColor,
        link: primaryTextColor,
        linkHover: primaryTextColor,
      },
    },
    components: {
      MuiTypography: {
        styleOverrides: {
          root: {
            // Custom Time Range Selector
            '&.MuiClock-meridiemText': {
              color: primaryTextColor,
            },
          },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          root: {
            color: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 'var(--pf-t--global--border--radius--medium)',
            borderColor: 'var(--pf-t--global--border--color--default)',
          },
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            '&.MuiCardHeader-root': {
              borderBottom: 'none',
              paddingBlockEnd: 'var(--pf-t--global--spacer--md)',
              paddingBlockStart: 'var(--pf-t--global--spacer--lg)',
              paddingLeft: 'var(--pf-t--global--spacer--lg)',
              paddingRight: 'var(--pf-t--global--spacer--lg)',
            },
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            '&.MuiCardContent-root': {
              borderTop: 'none',
              '&:last-child': {
                paddingBottom: 'var(--pf-t--global--spacer--lg)',
                paddingLeft: 'var(--pf-t--global--spacer--lg)',
                paddingRight: 'var(--pf-t--global--spacer--lg)',
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderColor: 'var(--pf-t--global--border--color--default)',
          },
          root: {
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--pf-t--global--border--color--default)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--pf-t--global--border--color--default)',
            },
          },
          input: {
            // Dashboard Variables >> Text Variable
            padding: '8.5px 14px',
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: primaryTextColor,
          },
        },
      },
    },
  };
};

export function PersesWrapper({ children, project }: PersesWrapperProps) {
  const { theme } = usePatternFlyTheme();
  const [dashboardName] = useQueryParam(QueryParams.Dashboard, StringParam);
  const muiTheme = getTheme(theme, {
    shape: {
      borderRadius: 6,
    },
    ...mapPatterflyThemeToMUI(theme),
  });

  const chartsTheme: PersesChartsTheme = generateChartsTheme(muiTheme, {
    echartsTheme: {
      color: patternflyChartsMultiUnorderedPalette,
    },
    thresholds: {
      defaultColor: patternflyBlue300,
      palette: defaultPaletteColors,
    },
  });

  return (
    <ThemeProvider theme={muiTheme}>
      <ChartsProvider chartsTheme={chartsTheme}>
        <SnackbarProvider
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="default"
          content=""
        >
          <PluginRegistry pluginLoader={pluginLoader}>
            {!project ? (
              <>{children}</>
            ) : (
              <InnerWrapper project={project} dashboardName={dashboardName}>
                {children}
              </InnerWrapper>
            )}
          </PluginRegistry>
        </SnackbarProvider>
      </ChartsProvider>
    </ThemeProvider>
  );
}

function InnerWrapper({ children, project, dashboardName }) {
  const { data } = usePluginBuiltinVariableDefinitions();
  const { persesDashboard, persesDashboardLoading } = useFetchPersesDashboard(
    project,
    dashboardName,
  );
  const DEFAULT_DASHBOARD_DURATION = '30m';
  const DEFAULT_REFRESH_INTERVAL = '0s';

  const initialTimeRange = useInitialTimeRange(DEFAULT_DASHBOARD_DURATION);
  const initialRefreshInterval = useInitialRefreshInterval(DEFAULT_REFRESH_INTERVAL);

  const builtinVariables = useMemo(() => {
    const result = [
      {
        kind: 'BuiltinVariable',
        spec: {
          name: '__dashboard',
          value: () => dashboardName,
          source: 'Dashboard',
          display: {
            name: '__dashboard',
            description: 'The name of the current dashboard',
            hidden: true,
          },
        },
      } as BuiltinVariableDefinition,
      {
        kind: 'BuiltinVariable',
        spec: {
          name: '__project',
          value: () => project,
          source: 'Dashboard',
          display: {
            name: '__project',
            description: 'The name of the current dashboard project',
            hidden: true,
          },
        },
      } as BuiltinVariableDefinition,
    ];
    if (data) {
      data.forEach((def: BuiltinVariableDefinition) => result.push(def));
    }
    return result;
  }, [data, project, dashboardName]);

  if (persesDashboardLoading) {
    return <LoadingBox />;
  }

  let clearedDashboardResource: DashboardResource | undefined;
  if (Array.isArray(persesDashboard)) {
    if (persesDashboard.length === 0) {
      clearedDashboardResource = undefined;
    } else {
      clearedDashboardResource = persesDashboard[0];
    }
  } else {
    clearedDashboardResource = persesDashboard;
  }

  return (
    <TimeRangeProviderWithQueryParams
      initialTimeRange={initialTimeRange}
      initialRefreshInterval={initialRefreshInterval}
    >
      <VariableProviderWithQueryParams
        builtinVariableDefinitions={builtinVariables}
        initialVariableDefinitions={clearedDashboardResource?.spec?.variables}
        key={clearedDashboardResource?.metadata.name}
      >
        <PersesPrometheusDatasourceWrapper
          queries={[]}
          dashboardResource={clearedDashboardResource}
        >
          {clearedDashboardResource ? (
            <DashboardProvider
              initialState={{
                isEditMode: false,
                dashboardResource: clearedDashboardResource,
              }}
            >
              {children}
            </DashboardProvider>
          ) : (
            <>{children}</>
          )}
        </PersesPrometheusDatasourceWrapper>
      </VariableProviderWithQueryParams>
    </TimeRangeProviderWithQueryParams>
  );
}

interface PersesPrometheusDatasourceWrapperProps {
  queries: Definition<UnknownSpec>[];
  dashboardResource?: DashboardResource;
  duration?: DurationString;
  children?: React.ReactNode;
}

export function PersesPrometheusDatasourceWrapper({
  queries,
  children,
  dashboardResource,
}: PersesPrometheusDatasourceWrapperProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const datasourceApi = useMemo(() => {
    return new CachedDatasourceAPI(new OcpDatasourceApi(t, PERSES_PROXY_BASE_PATH));
  }, [t]);

  return (
    <DatasourceStoreProvider dashboardResource={dashboardResource} datasourceApi={datasourceApi}>
      <DataQueriesProvider definitions={queries}>{children}</DataQueriesProvider>
    </DatasourceStoreProvider>
  );
}
