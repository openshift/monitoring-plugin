import { WSFactory } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory';
import { useContext, useReducer, useRef } from 'react';

import { queryHasNamespaceFilter } from '@/features/logging/components/error-message-utils';
import { LogsContext } from '@/features/logging/hooks/LogsConfigProvider';
import { LogQLQuery } from '@/features/logging/logql-query';
import {
  Config,
  Direction,
  isMatrixResult,
  isStreamsResult,
  QueryRangeResponse,
  Schema,
  TimeRange,
  VolumeRangeResponse,
} from '@/features/logging/logs-types';
import {
  connectToTailSocket,
  executeHistogramQuery,
  executeQueryRange,
  executeVolumeRange,
  throwResponseError,
  toQueryRangeResponse,
  toRecord,
  validateQueryRangeResponse,
} from '@/features/logging/loki-client';
import {
  intervalFromTimeRange,
  numericTimeRange,
  timeRangeFromDuration,
} from '@/features/logging/time-range';
import { getPaginationRange, msToNs } from '@/features/logging/value-utils';

const DEFAULT_TIME_SPAN = '1h';
const STREAMING_MAX_LOGS_LIMIT = 1e3;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

type State = {
  isLoadingHistogramData: boolean;
  histogramData?: QueryRangeResponse;
  histogramError?: unknown;
  isLoadingLogsData: boolean;
  isLoadingMoreLogsData: boolean;
  logsData?: QueryRangeResponse;
  logsError?: unknown;
  moreLogsError?: unknown;
  isLoadingVolumeData?: boolean;
  volumeData?: VolumeRangeResponse;
  volumeError?: unknown;
  showVolumeGraph?: boolean;
  hasMoreLogsData?: boolean;
  isStreaming: boolean;
  queriedWithNamespace: boolean;
};

type Action =
  | {
      type: 'histogramRequest';
    }
  | {
      type: 'histogramResponse';
      payload: { histogramData: QueryRangeResponse };
    }
  | {
      type: 'logsRequest';
      payload: { queriedWithNamespace: boolean };
    }
  | {
      type: 'moreLogsRequest';
    }
  | {
      type: 'logsResponse';
      payload: { logsData: QueryRangeResponse; config: Config };
    }
  | {
      type: 'startStreaming';
    }
  | {
      type: 'pauseStreaming';
    }
  | {
      type: 'streamingResponse';
      payload: { logsData: QueryRangeResponse };
    }
  | {
      type: 'moreLogsResponse';
      payload: { logsData: QueryRangeResponse; config: Config };
    }
  | {
      type: 'logsError';
      payload: { error: unknown };
    }
  | {
      type: 'moreLogsError';
      payload: { error: unknown };
    }
  | {
      type: 'histogramError';
      payload: { error: unknown };
    }
  | {
      type: 'volumeRequest';
    }
  | {
      type: 'volumeError';
      payload: { error: unknown };
    }
  | {
      type: 'volumeResponse';
      payload: { volumeData: VolumeRangeResponse };
    };

const appendData = (
  response?: QueryRangeResponse,
  nextResponse?: QueryRangeResponse,
  limit?: number,
): QueryRangeResponse | undefined => {
  if (
    response &&
    nextResponse &&
    ((isMatrixResult(response.data) && isMatrixResult(nextResponse.data)) ||
      (isStreamsResult(response.data) && isStreamsResult(nextResponse.data)))
  ) {
    const result = [...response.data.result, ...nextResponse.data.result];
    const limitedTailResult = limit ? result.slice(-limit) : result;

    return {
      ...response,
      data: {
        ...response.data,
        result: limitedTailResult,
      } as QueryRangeResponse['data'],
    };
  }

  return response ? response : nextResponse;
};

const hasMoreLogs = (response: QueryRangeResponse | undefined, limit: number): boolean => {
  if (response === undefined) return false;

  return (
    response?.data.result
      .map((result) => result.values.length)
      .reduce((sum, count) => sum + count, 0) >= limit
  );
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'histogramRequest':
      return {
        ...state,
        isLoadingHistogramData: true,
        histogramData: undefined,
        histogramError: undefined,
      };

    case 'histogramResponse':
      return {
        ...state,
        isLoadingHistogramData: false,
        showVolumeGraph: false,
        histogramData: action.payload.histogramData,
      };
    case 'histogramError':
      return {
        ...state,
        isLoadingHistogramData: false,
        histogramError: action.payload.error,
      };
    case 'logsRequest':
      return {
        ...state,
        isLoadingLogsData: true,
        logsData: undefined,
        logsError: undefined,
        moreLogsError: undefined,
        hasMoreLogsData: false,
        isLoadingMoreLogsData: false,
        isStreaming: false,
        isLoadingVolumeData: false,
        queriedWithNamespace: action.payload.queriedWithNamespace,
      };
    case 'startStreaming':
      return {
        ...state,
        logsData: undefined,
        logsError: undefined,
        moreLogsError: undefined,
        hasMoreLogsData: false,
        isStreaming: true,
      };
    case 'pauseStreaming':
      return {
        ...state,
        isStreaming: false,
        logsError: undefined,
      };
    case 'streamingResponse':
      return {
        ...state,
        logsData: appendData(state.logsData, action.payload.logsData, STREAMING_MAX_LOGS_LIMIT),
        hasMoreLogsData: false,
      };
    case 'volumeRequest':
      return {
        ...state,
        isLoadingVolumeData: true,
        volumeData: undefined,
        volumeError: undefined,
      };
    case 'volumeResponse':
      return {
        ...state,
        isLoadingVolumeData: false,
        showVolumeGraph: true,
        volumeData: action.payload.volumeData,
      };
    case 'volumeError':
      return {
        ...state,
        isLoadingVolumeData: false,
        volumeError: action.payload.error,
      };
    case 'moreLogsRequest':
      return {
        ...state,
        isLoadingMoreLogsData: true,
        logsError: undefined,
        moreLogsError: undefined,
      };
    case 'logsResponse':
      return {
        ...state,
        isLoadingLogsData: false,
        isLoadingMoreLogsData: false,
        showVolumeGraph: false,
        logsData: action.payload.logsData,
        hasMoreLogsData: hasMoreLogs(action.payload.logsData, action.payload.config.logsLimit),
      };
    case 'moreLogsResponse':
      return {
        ...state,
        isLoadingMoreLogsData: false,
        logsData: appendData(state.logsData, action.payload.logsData),
        hasMoreLogsData: hasMoreLogs(action.payload.logsData, action.payload.config.logsLimit),
      };
    case 'logsError':
      return {
        ...state,
        isLoadingLogsData: false,
        isLoadingMoreLogsData: false,
        logsError: action.payload.error,
        moreLogsError: undefined,
      };
    case 'moreLogsError':
      return {
        ...state,
        isLoadingLogsData: false,
        isLoadingMoreLogsData: false,
        logsError: undefined,
        moreLogsError: action.payload.error,
      };

    default:
      return state;
  }
};

const defaultTimeRange = (): TimeRange => timeRangeFromDuration(DEFAULT_TIME_SPAN);

type UseLogOptions = { initialTimeRange?: TimeRange; initialTenant?: string } | undefined;

export const useLogs = (
  { initialTimeRange = defaultTimeRange(), initialTenant = 'application' }: UseLogOptions = {
    initialTimeRange: defaultTimeRange(),
    initialTenant: 'application',
  },
) => {
  const currentQuery = useRef<string | undefined>();
  const currentTenant = useRef<string>(initialTenant);
  const currentTimeRange = useRef<TimeRange>(initialTimeRange);
  const lastExecutionTime = useRef<{ logs?: number; histogram?: number; volume?: number }>({
    logs: undefined,
    histogram: undefined,
    volume: undefined,
  });
  const currentDirection = useRef<Direction>('backward');
  const logsAbort = useRef<() => void | undefined>();
  const histogramAbort = useRef<() => void | undefined>();
  const volumeAbort = useRef<() => void | undefined>();
  const ws = useRef<WSFactory | null>();
  const logsContext = useContext(LogsContext);

  if (logsContext === undefined) {
    throw new Error('useLogs must be used within a LogsProvider');
  }

  const configRef = useRef(logsContext.config);
  // eslint-disable-next-line react-hooks/refs
  configRef.current = logsContext.config;

  const [
    {
      logsData,
      histogramData,
      isLoadingHistogramData,
      isLoadingLogsData,
      isLoadingVolumeData,
      isLoadingMoreLogsData,
      histogramError,
      volumeData,
      logsError,
      moreLogsError,
      volumeError,
      showVolumeGraph,
      hasMoreLogsData,
      isStreaming,
      queriedWithNamespace,
    },
    dispatch,
  ] = useReducer(reducer, {
    isLoadingHistogramData: false,
    isLoadingLogsData: false,
    isLoadingVolumeData: false,
    isLoadingMoreLogsData: false,
    hasMoreLogsData: false,
    isStreaming: false,
    queriedWithNamespace: false,
  });

  const getMoreLogs = async ({
    lastTimestampNs,
    query,
    namespace,
    direction,
    schema,
  }: {
    lastTimestampNs: string;
    query: string;
    namespace?: string;
    direction?: Direction;
    schema: Schema;
  }) => {
    if (query.length === 0) {
      dispatch({ type: 'moreLogsError', payload: { error: new Error('Query is empty') } });
      return;
    }

    try {
      currentQuery.current = query;
      currentDirection.current = direction ?? currentDirection.current;

      const { startNs, endNs } = getPaginationRange(lastTimestampNs, currentDirection.current);

      dispatch({ type: 'moreLogsRequest' });

      if (logsAbort.current) {
        logsAbort.current();
      }

      const config = configRef.current;

      const { request, abort } = executeQueryRange({
        query,
        startNs,
        endNs,
        config,
        tenant: currentTenant.current,
        namespace,
        direction: currentDirection.current,
        schema,
      });

      logsAbort.current = abort;

      const queryResponse = await request()
        .then(toRecord)
        .then(throwResponseError)
        .then(toQueryRangeResponse)
        .then(validateQueryRangeResponse);

      dispatch({
        type: 'moreLogsResponse',
        payload: { logsData: queryResponse, config },
      });
    } catch (error) {
      if (!isAbortError(error)) {
        dispatch({ type: 'moreLogsError', payload: { error } });
      }
    }
  };

  const getLogs = async ({
    query,
    tenant,
    timeRange,
    namespace,
    direction,
    schema,
  }: {
    query: string;
    tenant?: string;
    timeRange?: TimeRange;
    namespace?: string;
    direction?: Direction;
    schema: Schema;
  }) => {
    if (query.length === 0) {
      dispatch({ type: 'logsError', payload: { error: new Error('Query is empty') } });
      return;
    }

    // Throttle requests
    if (lastExecutionTime.current.logs && Date.now() - lastExecutionTime.current.logs < 50) {
      return;
    }

    try {
      currentQuery.current = query;
      currentTenant.current = tenant ?? currentTenant.current;
      lastExecutionTime.current.logs = Date.now();
      currentTimeRange.current = timeRange ?? currentTimeRange.current;
      currentDirection.current = direction ?? currentDirection.current;

      const { start, end } = numericTimeRange(currentTimeRange.current);

      dispatch({
        type: 'logsRequest',
        payload: {
          queriedWithNamespace: queryHasNamespaceFilter(query, currentTenant.current),
        },
      });

      if (logsAbort.current) {
        logsAbort.current();
      }

      const config = configRef.current;

      const { request, abort } = executeQueryRange({
        query,
        startNs: msToNs(start),
        endNs: msToNs(end),
        config,
        tenant: currentTenant.current,
        namespace,
        direction: currentDirection.current,
        schema,
      });

      logsAbort.current = abort;

      const queryResponse = await request()
        .then(toRecord)
        .then(throwResponseError)
        .then(toQueryRangeResponse)
        .then(validateQueryRangeResponse);

      dispatch({ type: 'logsResponse', payload: { logsData: queryResponse, config } });
    } catch (error) {
      if (!isAbortError(error)) {
        dispatch({ type: 'logsError', payload: { error } });
      }
    }
  };

  const pauseTailLog = () => {
    if (ws.current) {
      ws.current.destroy();
    }

    dispatch({ type: 'pauseStreaming' });
  };

  const startTailLog = ({
    query,
    tenant,
    namespace,
    schema,
  }: {
    query: string;
    tenant?: string;
    namespace?: string;
    schema: Schema;
  }) => {
    currentQuery.current = query;
    currentTenant.current = tenant ?? currentTenant.current;

    if (ws.current) {
      ws.current.destroy();
    }

    dispatch({ type: 'startStreaming' });

    ws.current = connectToTailSocket({
      query,
      tenant: currentTenant.current,
      namespace,
      schema,
      config: configRef.current,
    });

    ws.current.onerror((error) => {
      const errorMessage = (error as ErrorEvent).message ?? 'WebSocket error';
      dispatch({
        type: 'logsError',
        payload: { error: errorMessage },
      });
    });

    ws.current.onmessage((data) => {
      dispatch({
        type: 'streamingResponse',
        payload: {
          logsData: {
            status: 'success',
            data: {
              stats: { ingester: {}, querier: {}, summary: {} },
              resultType: 'streams',
              result: data.streams,
            },
          },
        },
      });
    });
  };

  const toggleStreaming = ({
    query,
    tenant,
    namespace,
    schema,
  }: {
    query: string;
    tenant?: string;
    namespace?: string;
    schema: Schema;
  }) => {
    currentQuery.current = query;
    currentTenant.current = tenant ?? currentTenant.current;

    if (isStreaming) {
      pauseTailLog();
    } else {
      startTailLog({ query, tenant, namespace, schema });
    }
  };

  const getVolume = async ({
    query,
    tenant,
    timeRange,
    namespace,
    schema,
  }: {
    query: string;
    tenant?: string;
    timeRange?: TimeRange;
    namespace?: string;
    schema: Schema;
  }) => {
    if (query.length === 0) {
      dispatch({ type: 'volumeError', payload: { error: new Error('Query is empty') } });
      return;
    }

    // Throttle requests
    if (lastExecutionTime.current.volume && Date.now() - lastExecutionTime.current.volume < 50) {
      return;
    }

    try {
      currentQuery.current = query;
      currentTenant.current = tenant ?? currentTenant.current;
      lastExecutionTime.current.volume = Date.now();
      currentTimeRange.current = timeRange ?? currentTimeRange.current;

      const { start, end } = numericTimeRange(currentTimeRange.current);

      dispatch({ type: 'volumeRequest' });

      if (volumeAbort.current) {
        volumeAbort.current();
      }

      const config = configRef.current;

      // Volume API only accepts labels, so have to extract them from the query.
      // Only grabs the data within the { }
      const logQLQuery = new LogQLQuery(query);
      query = `{ ${logQLQuery.streamSelector
        .map(
          ({ label, operator, value }) =>
            `${label}${operator !== undefined ? operator : ''}${value !== undefined ? value : ''}`,
        )
        .join(', ')} }`;

      const { request, abort } = executeVolumeRange({
        query,
        startNs: msToNs(start),
        endNs: msToNs(end),
        config,
        tenant: currentTenant.current,
        namespace,
        schema,
      });

      volumeAbort.current = abort;

      const volumeResponse = await request();

      dispatch({ type: 'volumeResponse', payload: { volumeData: volumeResponse } });
    } catch (error) {
      if (!isAbortError(error)) {
        dispatch({ type: 'volumeError', payload: { error } });
      }
    }
  };

  const getHistogram = async ({
    query,
    tenant,
    timeRange,
    namespace,
    schema,
  }: {
    query: string;
    tenant?: string;
    timeRange?: TimeRange;
    namespace?: string;
    schema: Schema;
  }) => {
    if (query.length === 0) {
      dispatch({ type: 'histogramError', payload: { error: new Error('Query is empty') } });
      return;
    }

    // Throttle histogram requests
    if (
      lastExecutionTime.current.histogram &&
      Date.now() - lastExecutionTime.current.histogram < 50
    ) {
      return;
    }

    try {
      currentQuery.current = query;
      currentTenant.current = tenant ?? currentTenant.current;
      lastExecutionTime.current.histogram = Date.now();
      currentTimeRange.current = timeRange ?? currentTimeRange.current;

      // TODO split on multiple/parallel queries for long timespans and concat results
      dispatch({ type: 'histogramRequest' });

      if (histogramAbort.current) {
        histogramAbort.current();
      }

      const { start, end } = numericTimeRange(currentTimeRange.current);

      const config = configRef.current;

      const { request, abort } = executeHistogramQuery({
        query,
        startNs: msToNs(start),
        endNs: msToNs(end),
        interval: intervalFromTimeRange(currentTimeRange.current),
        config,
        tenant: currentTenant.current,
        namespace,
        schema,
      });

      histogramAbort.current = abort;

      const histogramResponse = await request();

      dispatch({
        type: 'histogramResponse',
        payload: { histogramData: histogramResponse },
      });
    } catch (error) {
      if (!isAbortError(error)) {
        dispatch({ type: 'histogramError', payload: { error } });
      }
    }
  };

  return {
    logsData,
    volumeData,
    isLoadingLogsData,
    isLoadingMoreLogsData,
    isStreaming,
    histogramData,
    isLoadingHistogramData,
    isLoadingVolumeData,
    volumeError,
    showVolumeGraph,
    getLogs,
    getVolume,
    getMoreLogs,
    hasMoreLogsData,
    logsError,
    moreLogsError,
    getHistogram,
    histogramError,
    toggleStreaming,
    queriedWithNamespace,
  };
};
