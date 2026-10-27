import { WSFactory } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory';

import { queryWithNamespace } from '@/features/logging/components/AttributeFilters';
import {
  getStreamLabelsFromSchema,
  ResourceLabel,
} from '@/features/logging/components/ParseResources';
import { CancellableFetch, cancellableFetch } from '@/features/logging/utils/cancellable-fetch';
import {
  Config,
  Direction,
  LabelValueResponse,
  MatrixResult,
  QueryRangeResponse,
  RulesResponse,
  Schema,
  SeriesResponse,
  VolumeRangeResponse,
} from '@/features/logging/utils/logs-types';
import { durationFromTimestamp, getSchema } from '@/features/logging/utils/value-utils';

const LOKI_ENDPOINT = '/api/proxy/plugin/monitoring-console-plugin/loki';

type QueryRangeParams = {
  query: string;
  startNs: string;
  endNs: string;
  config?: Config;
  namespace?: string;
  tenant: string;
  direction?: Direction;
  schema: Schema;
};

type VolumeRangeParams = {
  query: string;
  startNs: string;
  endNs: string;
  config?: Config;
  namespace?: string;
  tenant: string;
  targetLabels?: string;
  schema: Schema;
};

type HistogramQuerParams = {
  query: string;
  startNs: string;
  endNs: string;
  interval: number;
  config?: Config;
  namespace?: string;
  tenant: string;
  schema: Schema;
};

type LokiTailQueryParams = {
  query: string;
  startNs?: string;
  config?: Config;
  namespace?: string;
  tenant: string;
  schema: Schema;
};

const MAX_RANGE_REQUEST_NS = 21_600_000_000_000n; // 6 hours in nanoseconds

export const isRecord = (response: unknown): response is Record<string, unknown> =>
  typeof response === 'object' && response !== null && !Array.isArray(response);

export const toRecord = (response: unknown): Record<string, unknown> => {
  if (!isRecord(response)) {
    throw new Error('Invalid Loki query response');
  }

  return response;
};

export const throwResponseError = (response: Record<string, unknown>): Record<string, unknown> => {
  if (response.status !== 'error') {
    return response;
  }

  const errorType = typeof response.errorType === 'string' ? response.errorType : undefined;
  const error = typeof response.error === 'string' ? response.error : undefined;
  throw new Error([errorType, error].filter(Boolean).join(': ') || 'Loki query failed');
};

export const isQueryRangeResponse = (
  response: Record<string, unknown>,
): response is QueryRangeResponse => {
  const data = response.data;
  return isRecord(data) && Array.isArray(data.result);
};

export const toQueryRangeResponse = (response: Record<string, unknown>): QueryRangeResponse => {
  if (!isQueryRangeResponse(response)) {
    throw new Error('Invalid Loki query response: missing data.result');
  }

  return response;
};

export const validateQueryRangeResponse = (response: QueryRangeResponse): QueryRangeResponse => {
  if (response.status !== 'success') {
    throw new Error(`Invalid Loki query response status: ${String(response.status)}`);
  }

  if (response.data.resultType !== 'streams' && response.data.resultType !== 'matrix') {
    throw new Error('Invalid Loki query response: invalid data.resultType');
  }

  return response;
};

export const getFetchConfig = ({
  config,
  tenant,
}: {
  config?: Config;
  tenant: string;
  endpoint?: string;
}): { requestInit?: RequestInit; endpoint: string; timeout?: number } => {
  const timeout = config?.timeout ? config.timeout * 1000 : undefined;

  if (config && config.useTenantInHeader === true) {
    return {
      requestInit: {
        headers: { 'X-Scope-OrgID': tenant },
      },
      endpoint: LOKI_ENDPOINT,
      timeout,
    };
  }

  return {
    requestInit: {},
    endpoint: `${LOKI_ENDPOINT}/api/logs/v1/${tenant}`,
    timeout,
  };
};

export const executeLabelValue = ({
  query,
  labelName,
  config,
  tenant,
}: {
  query?: string;
  labelName: string;
  config?: Config;
  tenant: string;
}): CancellableFetch<LabelValueResponse> => {
  const { endpoint, requestInit, timeout } = getFetchConfig({ config, tenant });

  const params: Record<string, string> = {};

  if (query) {
    params.query = query;
  }

  return cancellableFetch<LabelValueResponse>(
    `${endpoint}/loki/api/v1/label/${labelName}/values?${new URLSearchParams(params)}`,
    requestInit,
    timeout,
  );
};

export const executeSeries = ({
  match,
  config,
  tenant,
}: {
  match: Array<string>;
  config?: Config;
  tenant: string;
}): CancellableFetch<SeriesResponse> => {
  const { endpoint, requestInit, timeout } = getFetchConfig({ config, tenant });

  const params: Record<string, string> = {};

  for (const m of match) {
    params['match[]'] = m;
  }

  return cancellableFetch<SeriesResponse>(
    `${endpoint}/loki/api/v1/series?${new URLSearchParams(params)}`,
    requestInit,
    timeout,
  );
};

export const executeQueryRange = ({
  query,
  startNs,
  endNs,
  config,
  tenant,
  namespace,
  direction,
  schema,
}: QueryRangeParams): CancellableFetch<QueryRangeResponse> => {
  const extendedQuery = queryWithNamespace({
    query,
    namespace,
    schema,
  });

  const params: Record<string, string> = {
    query: extendedQuery,
    start: startNs,
    end: endNs,
    limit: String(config?.logsLimit ?? 100),
  };

  if (direction) {
    params.direction = direction;
  }

  const { endpoint, requestInit, timeout } = getFetchConfig({ config, tenant });

  return cancellableFetch<QueryRangeResponse>(
    `${endpoint}/loki/api/v1/query_range?${new URLSearchParams(params)}`,
    requestInit,
    timeout,
  );
};

export const executeVolumeRange = ({
  query,
  startNs,
  endNs,
  config,
  tenant,
  namespace,
  schema,
}: VolumeRangeParams): CancellableFetch<VolumeRangeResponse> => {
  const extendedQuery = queryWithNamespace({
    query,
    namespace,
    schema,
  });

  const params: Record<string, string> = {
    query: extendedQuery,
    start: startNs,
    end: endNs,
  };

  const { endpoint, requestInit, timeout } = getFetchConfig({ config, tenant });

  return cancellableFetch<VolumeRangeResponse>(
    `${endpoint}/loki/api/v1/index/volume_range?${new URLSearchParams(params)}`,
    requestInit,
    timeout,
  );
};

const splitQueryRange = (startNs: string, endNs: string): string[][] => {
  const start = BigInt(startNs);
  const end = BigInt(endNs);
  const ranges: string[][] = [];
  let currentStart = start;
  let currentEnd = start + MAX_RANGE_REQUEST_NS;

  while (currentEnd < end) {
    ranges.push([String(currentStart), String(currentEnd)]);
    currentStart = currentEnd;
    currentEnd = currentEnd + MAX_RANGE_REQUEST_NS;
  }

  ranges.push([String(currentStart), String(end)]);

  return ranges;
};

export const executeHistogramQuery = ({
  query,
  startNs,
  endNs,
  interval,
  config,
  tenant,
  namespace,
  schema,
}: HistogramQuerParams): CancellableFetch<QueryRangeResponse<MatrixResult>> => {
  const intervalString = durationFromTimestamp(interval);
  const labels = getStreamLabelsFromSchema(schema);
  const labelSeverity = labels[ResourceLabel.Severity];

  const extendedQuery = queryWithNamespace({
    query,
    namespace,
    schema,
  });

  // eslint-disable-next-line max-len
  const histogramQuery = `sum by (${labelSeverity}) (count_over_time(${extendedQuery} [${intervalString}]))`;

  const params = {
    query: histogramQuery,
    start: startNs,
    end: endNs,
    step: intervalString,
  };

  const { endpoint, requestInit, timeout } = getFetchConfig({ config, tenant });

  const timeRangeNs = BigInt(endNs) - BigInt(startNs);

  // for large time ranges, split the query into multiple smaller queries
  if (timeRangeNs > MAX_RANGE_REQUEST_NS) {
    const ranges = splitQueryRange(startNs, endNs);

    const queries: Array<CancellableFetch<QueryRangeResponse<MatrixResult>>> = [];

    for (const range of ranges) {
      const [rangeStart, rangeEnd] = range;
      const rangeParams = {
        ...params,
        start: rangeStart,
        end: rangeEnd,
      };
      const subQuery = cancellableFetch<QueryRangeResponse<MatrixResult>>(
        `${endpoint}/loki/api/v1/query_range?${new URLSearchParams(rangeParams)}`,
        requestInit,
        timeout,
      );

      queries.push(subQuery);
    }

    return {
      request: async () => {
        const responses = [];
        // execute the queries sequentially
        for (const subQuery of queries) {
          const response = await subQuery.request();
          responses.push(response);
        }

        return responses.reduce((acc, response) => {
          if (Object.keys(acc).length == 0) {
            return response;
          }

          // if any of the responses is not successful, skip it
          if (response.status !== 'success') {
            return acc;
          }

          acc.data.result = acc.data.result.concat(response.data.result);

          return acc;
        }, {} as QueryRangeResponse<MatrixResult>);
      },
      abort: () => {
        for (const subQuery of queries) {
          subQuery.abort();
        }
      },
    };
  }

  return cancellableFetch<QueryRangeResponse<MatrixResult>>(
    `${endpoint}/loki/api/v1/query_range?${new URLSearchParams(params)}`,
    requestInit,
    timeout,
  );
};

export const connectToTailSocket = ({
  query,
  startNs,
  config,
  tenant,
  namespace,
  schema,
}: LokiTailQueryParams) => {
  const extendedQuery = queryWithNamespace({
    query,
    namespace,
    schema,
  });

  const params: Record<string, string> = {
    query: extendedQuery,
    limit: String(config?.logsLimit ?? 200),
  };

  if (startNs) {
    params.start = startNs;
  }

  const { endpoint } = getFetchConfig({ config, tenant });

  const url = `${endpoint}/loki/api/v1/tail?${new URLSearchParams(params)}`;

  return new WSFactory(url, {
    host: 'auto',
    path: url,
    subprotocols: ['json'],
    jsonParse: true,
  });
};

export const getRules = ({
  config,
  tenant,
  namespace,
}: {
  config?: Config;
  tenant: string;
  namespace?: string;
}) => {
  const { endpoint, requestInit, timeout } = getFetchConfig({
    config,
    tenant,
  });

  let url = `${endpoint}/prometheus/api/v1/rules`;

  const labelMatchers = getStreamLabelsFromSchema(getSchema(config?.schema));
  const namespaceLabel = labelMatchers[ResourceLabel.Namespace];

  const alertingRulesNamespaceLabelKey = config?.alertingRuleNamespaceLabelKey || namespaceLabel;

  if (namespace) {
    url = `${url}?${alertingRulesNamespaceLabelKey}=${namespace}`;
  }

  return cancellableFetch<RulesResponse>(url, requestInit, timeout);
};
