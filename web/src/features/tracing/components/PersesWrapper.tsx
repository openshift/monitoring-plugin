import { ComponentProps, ReactElement, ReactNode, useMemo } from 'react';
import {
  ChartsProvider,
  generateChartsTheme,
  getTheme,
  PersesChartsTheme,
  typography,
} from '@perses-dev/components';
import { ThemeProvider } from '@mui/material';
import {
  DataQueriesProvider,
  dynamicImportPluginLoader,
  getPluginModuleCompoundKey,
  PanelData,
  PanelPlugin,
  PanelProps,
  PluginModuleResource,
  PluginRegistry,
  RouterProvider,
  TimeRangeProviderWithQueryParams,
  useDataQueriesContext,
  useInitialTimeRange,
} from '@perses-dev/plugin-system';
import { DatasourceResource, GlobalDatasourceResource, DatasourceApi } from '@perses-dev/client';
import {
  DatasourceStoreProvider,
  Panel,
  PanelProps as DashboardPanelProps,
  VariableProvider,
} from '@perses-dev/dashboards';
import * as tempoPlugin from '@perses-dev/tempo-plugin';
import * as scatterChartPlugin from '@perses-dev/scatter-chart-plugin';
import * as traceTablePlugin from '@perses-dev/trace-table-plugin';
import * as tracingGanttChartPlugin from '@perses-dev/tracing-gantt-chart-plugin';
import { ChartThemeColor, getThemeColors } from '@patternfly/react-charts/victory';
import { TempoInstance } from '../hooks/useTempoInstance';
import { getProxyURLFor } from '../hooks/api';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorAlert } from './ErrorAlert';
import { NoTempoInstanceSelectedState } from './NoTempoInstanceSelectedState';
import { LoadingState } from './LoadingState';
import { usePatternFlyTheme } from './console/utils/usePatternFlyTheme';
import { Link as RouterLink, useNavigate } from 'react-router';
import './PersesWrapper.css';
import { DurationString, QueryDefinition, TraceData, UnknownSpec } from '@perses-dev/spec';

class DatasourceApiImpl implements DatasourceApi {
  constructor(public proxyDatasource: GlobalDatasourceResource) {}

  getDatasource(): Promise<DatasourceResource | undefined> {
    return Promise.resolve(undefined);
  }
  getGlobalDatasource(): Promise<GlobalDatasourceResource | undefined> {
    return Promise.resolve(this.proxyDatasource);
  }
  listDatasources(): Promise<DatasourceResource[]> {
    return Promise.resolve([]);
  }
  listGlobalDatasources(): Promise<GlobalDatasourceResource[]> {
    return Promise.resolve([this.proxyDatasource]);
  }
  buildProxyUrl(): string {
    return '/';
  }
}

// Override eChart defaults with PatternFly colors.
const patternflyBlue300 = '#2b9af3';
const patternflyBlue400 = '#0066cc';
const patternflyBlue500 = '#004080';
const patternflyBlue600 = '#002952';
const defaultPaletteColors = [patternflyBlue400, patternflyBlue500, patternflyBlue600];

const chartColorScale = getThemeColors(ChartThemeColor.multiUnordered).chart?.colorScale;
const patternflyChartsMultiUnorderedPalette = Array.isArray(chartColorScale)
  ? chartColorScale.flatMap((cssColor: string) => {
      // colors are stored as 'var(--pf-chart-theme--multi-color-unordered--ColorScale--3400, #73c5c5)'
      // need to extract the hex value, because fillStyle() of <canvas> does not support CSS vars
      const match = cssColor.match(/#[a-fA-F0-9]+/);
      return match ? [match[0]] : [];
    })
  : [];

type PersesPluginModule = { getPluginModule: () => PluginModuleResource } & Record<string, unknown>;

// This workaround can be dropped once https://github.com/perses/shared/pull/211 is released
function toPluginRegistryModule(module: PersesPluginModule): Record<string, unknown> {
  const { metadata, spec } = module.getPluginModule();
  return Object.fromEntries(
    spec.plugins.map((plugin) => [
      getPluginModuleCompoundKey({
        kind: plugin.kind,
        name: plugin.spec.name,
        registry: metadata.registry,
        version: metadata.version,
      }),
      module[plugin.spec.name],
    ]),
  );
}

// PluginRegistry configuration to allow access to
// visualization panels/charts (@perses-dev/panels-plugin)
// and data handlers for tempo (@perses-dev/tempo-plugin).
const pluginLoader = dynamicImportPluginLoader(
  [tempoPlugin, scatterChartPlugin, traceTablePlugin, tracingGanttChartPlugin].map((x) => ({
    resource: x.getPluginModule(),
    importPlugin: () => Promise.resolve(toPluginRegistryModule(x)),
  })),
);

interface PersesWrapperProps {
  children?: ReactNode;
}

/**
 * PersesWrapper initializes the MUI theme, Perses router provider and Perses plugin registry.
 */
export function PersesWrapper({ children }: PersesWrapperProps) {
  const { theme } = usePatternFlyTheme();
  const navigate = useNavigate();

  const muiTheme = getTheme(theme, {
    typography: {
      ...typography,
      fontFamily: 'var(--pf-t--global--font--family--body)',
    },
    cssVariables: true,
    // Remove casting once https://github.com/perses/perses/pull/3443 is merged
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

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
      <RouterProvider RouterComponent={RouterLink} navigate={navigate}>
        <ChartsProvider chartsTheme={chartsTheme}>
          <PluginRegistry pluginLoader={pluginLoader}>{children}</PluginRegistry>
        </ChartsProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}

interface PersesDashboardWrapperProps {
  children?: ReactNode;
}

/**
 * PersesDashboardWrapper initializes the dashboard time range and variable providers.
 */
export function PersesDashboardWrapper({ children }: PersesDashboardWrapperProps) {
  const DEFAULT_DASHBOARD_DURATION = '30m';
  const initialTimeRange = useInitialTimeRange(DEFAULT_DASHBOARD_DURATION);

  return (
    <TimeRangeProviderWithQueryParams initialTimeRange={initialTimeRange}>
      <VariableProvider>{children}</VariableProvider>
    </TimeRangeProviderWithQueryParams>
  );
}

interface PersesTempoDatasourceWrapperProps {
  tempo: TempoInstance | undefined;
  definitions: QueryDefinition<unknown, UnknownSpec>[];
  duration?: DurationString;
  children?: ReactNode;
}

/**
 * PersesTempoDatasourceWrapper initializes the Tempo data source.
 */
export function PersesTempoDatasourceWrapper({
  tempo,
  definitions,
  children,
}: PersesTempoDatasourceWrapperProps) {
  const datasourceApi = useMemo(() => {
    const proxyDatasource: GlobalDatasourceResource = {
      kind: 'GlobalDatasource',
      metadata: { name: 'TempoProxy' },
      spec: {
        default: true,
        plugin: {
          kind: 'TempoDatasource',
          spec: {
            directUrl: tempo ? getProxyURLFor(tempo) : '',
          },
        },
      },
    };
    return new DatasourceApiImpl(proxyDatasource);
  }, [tempo]);

  if (!tempo) {
    return <NoTempoInstanceSelectedState />;
  }

  return (
    <DatasourceStoreProvider datasourceApi={datasourceApi}>
      <DataQueriesProvider definitions={definitions}>{children}</DataQueriesProvider>
    </DatasourceStoreProvider>
  );
}

interface PersesPanelPluginWrapperProps<T> {
  plugin: T;
  noResults?: ReactNode;
}

/**
 * PersesPanelWrapper renders a Perses panel plugin and shows PatternFly empty, loading states and error states.
 */
export function PersesPanelPluginWrapper<
  T extends PanelPlugin<Spec, PanelProps<Spec, TraceData>>,
  Spec = any, // eslint-disable-line @typescript-eslint/no-explicit-any
>(
  props: PersesPanelPluginWrapperProps<T> &
    Omit<ComponentProps<T['PanelComponent']>, 'queryResults'>,
) {
  const { plugin, noResults, ...otherProps } = props;
  const { isFetching, isLoading, queryResults } = useDataQueriesContext();

  // queryResults is an empty array until the TempoTraceQuery plugin is loaded
  if (isLoading || isFetching || queryResults.length === 0) {
    return <LoadingState />;
  }

  const queryError = queryResults.find((d) => d.error);
  if (queryError) {
    return <ErrorAlert error={queryError.error as Error} />;
  }

  const queryResultsWithData = queryResults.flatMap((q) =>
    q.data ? [{ data: q.data, definition: q.definition }] : [],
  ) as PanelData<TraceData>[];
  const traceDataFound = queryResultsWithData.some(
    ({ data }) =>
      ('searchResult' in data && data.searchResult && data.searchResult.length > 0) ||
      ('trace' in data && data.trace),
  );
  if (!traceDataFound && noResults) {
    return <>{noResults}</>;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorAlert} resetKeys={[]}>
      <plugin.PanelComponent queryResults={queryResultsWithData} {...otherProps} />
    </ErrorBoundary>
  );
}

interface PersesTracePanelWrapperProps {
  noResults?: ReactElement;
}

/**
 * PersesTracePanelWrapper renders a full Perses panel, including panel header and panel content.
 */
export function PersesTracePanelWrapper(props: PersesTracePanelWrapperProps & DashboardPanelProps) {
  const { noResults, ...panelProps } = props;
  const { loading, error, hasTraceData } = usePersesTraceData();

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorAlert error={error as Error} />;
  }

  if (!hasTraceData && noResults) {
    return <>{noResults}</>;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorAlert}>
      <Panel {...panelProps} />
    </ErrorBoundary>
  );
}

export function usePersesTraceData(): { loading: boolean; error?: unknown; hasTraceData: boolean } {
  const { isLoading, isFetching, queryResults } = useDataQueriesContext();

  // queryResults is an empty array until the TempoTraceQuery plugin is loaded
  const loading = isLoading || isFetching || queryResults.length === 0;
  const error = queryResults.find((d) => d.error)?.error;
  const hasTraceData = queryResults.some(
    ({ data }) =>
      (data && 'searchResult' in data && data.searchResult && data.searchResult.length > 0) ||
      (data && 'trace' in data && data.trace),
  );

  return { loading, error, hasTraceData };
}
