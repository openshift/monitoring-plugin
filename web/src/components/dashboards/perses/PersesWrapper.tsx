import React, { useMemo } from 'react';
import {
  ChartsProvider,
  ErrorBoundary,
  generateChartsTheme,
  getTheme,
  PersesChartsTheme,
  SnackbarProvider,
  typography,
} from '@perses-dev/components';
import { ThemeProvider } from '@mui/material';
import {
  DataQueriesProvider,
  dynamicImportPluginLoader,
  PluginModuleResource,
  PluginRegistry,
  TimeRangeProvider,
  useDataQueries,
  usePluginBuiltinVariableDefinitions,
} from '@perses-dev/plugin-system';
import {
  BuiltinVariableDefinition,
  Definition,
  DurationString,
  DashboardResource,
  UnknownSpec,
} from '@perses-dev/core';
import panelsResource from '@perses-dev/panels-plugin/plugin.json';
import prometheusResource from '@perses-dev/prometheus-plugin/plugin.json';
import {
  DashboardProvider,
  DatasourceStoreProvider,
  VariableProviderWithQueryParams,
} from '@perses-dev/dashboards';
import { ChartThemeColor, getThemeColors } from '@patternfly/react-charts';
import ErrorAlert from '../../console/console-shared/alerts/error';
import { usePatternFlyTheme } from './hooks/usePatternflyTheme';
import { CachedDatasourceAPI } from './perses/datasource-api';
import { OcpDatasourceApi } from './datasource-api';
import { PERSES_PROXY_BASE_PATH, useFetchPersesDashboard } from './perses-client';
import { usePersesTimeRange } from './hooks/usePersesTimeRange';
import { usePersesRefreshInterval } from './hooks/usePersesRefreshInterval';
import { QueryParams } from '../../query-params';
import { StringParam, useQueryParam } from 'use-query-params';
import { useCookieWatcher } from './hooks/useCookieWatcher';
import { useTranslation } from 'react-i18next';
import { LoadingInline } from '../../console/console-shared/src/components/loading/LoadingInline';

// Override eChart defaults with PatternFly colors.
const patternflyBlue300 = '#2b9af3';
const patternflyBlue400 = '#0066cc';
const patternflyBlue500 = '#004080';
const patternflyBlue600 = '#002952';
const defaultPaletteColors = [patternflyBlue400, patternflyBlue500, patternflyBlue600];

const patternflyChartsMultiUnorderedPalette = getThemeColors(
  ChartThemeColor.multiUnordered,
).chart.colorScale.flatMap((cssColor) => {
  // colors are stored as 'var(--pf-chart-theme--multi-color-unordered--ColorScale--3400, #73c5c5)'
  // need to extract the hex value, because fillStyle() of <canvas> does not support CSS vars
  const match = cssColor.match(/#[a-fA-F0-9]+/);
  return match ? [match[0]] : [];
});

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

export function PersesWrapper({ children, project }: PersesWrapperProps) {
  const { theme } = usePatternFlyTheme();
  const [dashboardName] = useQueryParam(QueryParams.Dashboard, StringParam);

  const muiTheme = getTheme(theme, {
    typography: {
      ...typography,
      fontFamily: 'var(--pf-v5-global--FontFamily--text)',
    },
    shape: {
      borderRadius: 0,
    },
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
  const persesTimeRange = usePersesTimeRange();
  const persesRefrshInterval = usePersesRefreshInterval();

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
    return null;
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
    <TimeRangeProvider refreshInterval={persesRefrshInterval} timeRange={persesTimeRange}>
      <VariableProviderWithQueryParams
        builtinVariableDefinitions={builtinVariables}
        initialVariableDefinitions={persesDashboard?.spec?.variables}
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
    </TimeRangeProvider>
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
  const csrfToken = useCookieWatcher('csrf-token', { valueOnly: true });
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const datasourceApi = React.useMemo(() => {
    return new CachedDatasourceAPI(new OcpDatasourceApi(csrfToken, t, PERSES_PROXY_BASE_PATH));
  }, [csrfToken, t]);

  return (
    <DatasourceStoreProvider dashboardResource={dashboardResource} datasourceApi={datasourceApi}>
      <DataQueriesProvider definitions={queries}>{children}</DataQueriesProvider>
    </DatasourceStoreProvider>
  );
}

interface TimeSeriesPanelWrapperProps {
  noResults?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * PrometheusQueryPanelWrapper intercepts the promql query status and displays PatternFly
 * native empty and loading states
 * instead of the Material UI empty and loading states used by Perses.
 */
export function TimeseriesQueryPanelWrapper({ noResults, children }: TimeSeriesPanelWrapperProps) {
  const { isFetching, isLoading, queryResults } = useDataQueries('TimeSeriesQuery');

  if (isLoading || isFetching) {
    return <LoadingInline />;
  }

  const queryError = queryResults.find((d) => d.error);
  if (queryError) {
    return <ErrorAlert error={queryError.error as Error} />;
  }

  const dataFound = queryResults.some(
    (timeSeriesData) =>
      (timeSeriesData.data?.series ?? []).length > 0 || timeSeriesData.data?.series,
  );
  if (!dataFound && noResults) {
    return <>{noResults}</>;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorAlert} resetKeys={[]}>
      {children}
    </ErrorBoundary>
  );
}
