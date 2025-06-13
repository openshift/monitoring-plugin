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

import { t_color_gray_95, t_color_white } from '@patternfly/react-tokens';

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
  return {
    typography: {
      fontFamily: 'var(--pf-t--global--font--family--body)',
      ...typography,
    },
    components: {
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
          },
        },
      },
    },
    palette: {
      primary: {
        main: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
      },
      background: {
        navigation: 'var(--pf-t--global--background--color--primary--default)',
        default: 'var(--pf-t--global--background--color--primary--default)',
        paper: 'var(--pf-t--global--background--color--primary--default)',
        code: 'var(--pf-t--global--background--color--primary--default)',
        tooltip: 'var(--pf-t--global--background--color--primary--default)',
        lighter: 'var(--pf-t--global--background--color--primary--default)',
        border: 'var(--pf-t--global--background--color--primary--default)',
      },
      text: {
        navigation: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        accent: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        primary: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        secondary: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        disabled: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        link: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
        linkHover: theme === 'dark' ? t_color_white.value : t_color_gray_95.value,
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
  const datasourceApi = React.useMemo(() => {
    return new CachedDatasourceAPI(new OcpDatasourceApi(t, PERSES_PROXY_BASE_PATH));
  }, [t]);

  return (
    <DatasourceStoreProvider dashboardResource={dashboardResource} datasourceApi={datasourceApi}>
      <DataQueriesProvider definitions={queries}>{children}</DataQueriesProvider>
    </DatasourceStoreProvider>
  );
}
