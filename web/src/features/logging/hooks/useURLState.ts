import { DependencyList, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { filtersFromQuery, queryFromFilters } from '@/features/logging/components/AttributeFilters';
import { AttributeList, Filters } from '@/features/logging/components/filters/filter-types';
import {
  ResourceLabel,
  ResourceToStreamLabels,
} from '@/features/logging/components/ParseResources';
import { useLogsConfig } from '@/features/logging/hooks/LogsConfigProvider';
import { getBrowserTimezone } from '@/features/logging/utils/date-utils';
import {
  Config,
  Direction,
  Schema,
  SchemaConfig,
  TimeRange,
} from '@/features/logging/utils/logs-types';
import { intervalFromTimeRange } from '@/features/logging/utils/time-range';
import { getSchema } from '@/features/logging/utils/value-utils';

interface UseURLStateHook {
  defaultTenant?: string;
  getDefaultQuery?({ tenant, schema }: { tenant: string; schema: Schema }): string;
  getAttributes?: ({
    tenant,
    config,
    schema,
    t,
  }: {
    tenant: string;
    config: Config;
    schema: Schema;
    t: (key: string) => string;
  }) => AttributeList | undefined;
  attributesDependencies?: DependencyList;
}

const QUERY_PARAM_KEY = 'q';
const TIME_RANGE_START = 'start';
const TIME_RANGE_END = 'end';
const DIRECTION = 'direction';
const TENANT_PARAM_KEY = 'tenant';
const SCHEMA_PARAM_KEY = 'schema';
const SHOW_RESOURCES_PARAM_KEY = 'showResources';
const SHOW_STATS_PARAM_KEY = 'showStats';
const TIMEZONE_PARAM_KEY = 'tz';
const STORED_TIMEZONE_KEY = 'logging-view-plugin/timezone';

export const DEFAULT_TENANT = 'application';
const DEFAULT_SHOW_RESOURCES = '0';
const DEFAULT_SHOW_STATS = '0';

export const defaultQueryFromTenant = ({
  tenant = DEFAULT_TENANT,
  schema,
}: {
  tenant?: string;
  schema: Schema;
}) => {
  const logType = ResourceToStreamLabels[ResourceLabel.LogType];
  return `{ ${schema === Schema.otel ? logType.otel : logType.viaq}="${tenant}" }${schema === Schema.viaq ? ' | json' : ''}`;
};

const getDirectionValue = (value?: string | null): Direction =>
  value !== null ? (value === 'forward' ? 'forward' : 'backward') : 'backward';

export const useURLState = ({
  defaultTenant = DEFAULT_TENANT,
  getDefaultQuery,
  getAttributes,
  attributesDependencies,
}: UseURLStateHook) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [queryParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { config, configLoaded } = useLogsConfig();

  const initialTenant = queryParams.get(TENANT_PARAM_KEY) ?? defaultTenant;
  const initialSchema: Schema = getSchema(queryParams.get(SCHEMA_PARAM_KEY) ?? config?.schema);

  const initialQuery =
    queryParams.get(QUERY_PARAM_KEY) ??
    getDefaultQuery?.({ tenant: initialTenant, schema: initialSchema }) ??
    defaultQueryFromTenant({ tenant: initialTenant, schema: initialSchema });

  const initialTimeRangeStart = queryParams.get(TIME_RANGE_START);
  const initialTimeRangeEnd = queryParams.get(TIME_RANGE_END);
  const initialDirection = queryParams.get(DIRECTION);
  const initialResorcesShown =
    (queryParams.get(SHOW_RESOURCES_PARAM_KEY) ?? DEFAULT_SHOW_RESOURCES) === '1';

  const intitalStatsShown = (queryParams.get(SHOW_STATS_PARAM_KEY) ?? DEFAULT_SHOW_STATS) === '1';

  // Timezone: URL param takes precedence over localStorage,
  // which takes precedence over browser default
  const getStoredTimezone = (): string | null => {
    try {
      const stored = window.localStorage.getItem(STORED_TIMEZONE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };
  const initialTimezone =
    queryParams.get(TIMEZONE_PARAM_KEY) ?? getStoredTimezone() ?? getBrowserTimezone();

  const [query, setQuery] = useState(initialQuery);
  const [tenant, setTenant] = useState(initialTenant);
  const [schema, setSchema] = useState(initialSchema);
  const attributes = useMemo<AttributeList>(
    () => (getAttributes ? (getAttributes({ tenant, config, schema, t }) ?? []) : []),
    [tenant, config, schema, ...(attributesDependencies || [])], // eslint-disable-line
  );
  const [filters, setFilters] = useState<Filters | undefined>(
    filtersFromQuery({ query: initialQuery, attributes, schema }),
  );

  const [areResourcesShown, setAreResourcesShown] = useState<boolean>(initialResorcesShown);
  const [areStatsShown, setAreStatsShown] = useState<boolean>(intitalStatsShown);
  const [direction, setDirection] = useState<Direction>(getDirectionValue(initialDirection));
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [timeRange, setTimeRange] = useState<TimeRange | undefined>(
    initialTimeRangeStart && initialTimeRangeEnd
      ? {
          start: initialTimeRangeStart,
          end: initialTimeRangeEnd,
        }
      : undefined,
  );

  const setQueryInURL = (newQuery: string, replace?: boolean) => {
    const trimmedQuery = newQuery.trim();
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(QUERY_PARAM_KEY, trimmedQuery);
    navigate(
      `${location.pathname}?${newQueryParams.toString()}`,
      replace ? { replace: true } : undefined,
    );
  };

  const setTenantInURL = (selectedTenant: string) => {
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(QUERY_PARAM_KEY, ''); // reset query when changing tenant
    newQueryParams.set(TENANT_PARAM_KEY, selectedTenant);
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
  };

  const setSchemaInURL = (selectedSchema: Schema) => {
    const newQueryParams = new URLSearchParams(queryParams);
    if (selectedSchema) {
      newQueryParams.set(SCHEMA_PARAM_KEY, selectedSchema as string);

      // re create query based on current filters and new schema
      const newQuery = queryFromFilters({
        existingQuery: '',
        filters,
        attributes,
        tenant,
        schema: selectedSchema,
      });
      newQueryParams.set(QUERY_PARAM_KEY, newQuery);

      navigate(`${location.pathname}?${newQueryParams.toString()}`);
    } else {
      newQueryParams.delete(SCHEMA_PARAM_KEY);
      navigate(`${location.pathname}?${newQueryParams.toString()}`);
    }
  };

  const setShowResourcesInURL = (showResources: boolean) => {
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(SHOW_RESOURCES_PARAM_KEY, showResources ? '1' : '0');
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
  };

  const setShowStatsInURL = (showStats: boolean) => {
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(SHOW_STATS_PARAM_KEY, showStats ? '1' : '0');
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
  };

  const setTimeRangeInURL = (selectedTimeRange: TimeRange) => {
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(TIME_RANGE_START, String(selectedTimeRange.start));
    newQueryParams.set(TIME_RANGE_END, String(selectedTimeRange.end));
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
  };

  const setDirectionInURL = (selectedDirection?: 'forward' | 'backward') => {
    const newQueryParams = new URLSearchParams(queryParams);
    if (selectedDirection) {
      newQueryParams.set(DIRECTION, selectedDirection);
    } else {
      newQueryParams.delete(DIRECTION);
    }
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
  };

  const setTimezoneInURL = (selectedTimezone: string) => {
    const newQueryParams = new URLSearchParams(queryParams);
    newQueryParams.set(TIMEZONE_PARAM_KEY, selectedTimezone);
    navigate(`${location.pathname}?${newQueryParams.toString()}`);
    // Also persist to localStorage
    try {
      window.localStorage.setItem(STORED_TIMEZONE_KEY, JSON.stringify(selectedTimezone));
    } catch {
      // Ignore localStorage errors
    }
  };

  useEffect(() => {
    if (config?.schema != SchemaConfig.select) {
      const queryFromParams = queryParams.get(QUERY_PARAM_KEY);

      const queryInNewSchema =
        getDefaultQuery?.({ tenant: initialTenant, schema: initialSchema }) ??
        defaultQueryFromTenant({ tenant: initialTenant, schema: initialSchema });

      if (!queryFromParams) {
        setQueryInURL(queryInNewSchema, true);
      } else {
        // only replace the current query if its the default query
        const defaultOtelQuery =
          getDefaultQuery?.({ tenant: initialTenant, schema: Schema.otel }) ??
          defaultQueryFromTenant({ tenant: initialTenant, schema: Schema.otel });

        const defaultViaqQuery =
          getDefaultQuery?.({ tenant: initialTenant, schema: Schema.viaq }) ??
          defaultQueryFromTenant({ tenant: initialTenant, schema: Schema.viaq });

        if (queryFromParams == defaultOtelQuery || queryFromParams == defaultViaqQuery) {
          setQueryInURL(queryInNewSchema, true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSchema, schema, configLoaded]);

  useEffect(() => {
    const schemaValue = getSchema(queryParams.get(SCHEMA_PARAM_KEY) ?? config?.schema);
    const queryValue = queryParams.get(QUERY_PARAM_KEY) ?? initialQuery;
    const tenantValue = queryParams.get(TENANT_PARAM_KEY) ?? DEFAULT_TENANT;
    const showResourcesValue = queryParams.get(SHOW_RESOURCES_PARAM_KEY) ?? DEFAULT_SHOW_RESOURCES;
    const showStatsValue = queryParams.get(SHOW_STATS_PARAM_KEY) ?? DEFAULT_SHOW_STATS;
    const timeRangeStartValue = queryParams.get(TIME_RANGE_START);
    const timeRangeEndValue = queryParams.get(TIME_RANGE_END);
    const directionValue = queryParams.get(DIRECTION);
    const timezoneValue =
      queryParams.get(TIMEZONE_PARAM_KEY) ?? getStoredTimezone() ?? getBrowserTimezone();

    setQuery(queryValue.trim());
    setTenant(tenantValue);
    setSchema(schemaValue);
    setDirection(getDirectionValue(directionValue));
    setTimezone(timezoneValue);
    setAreResourcesShown(showResourcesValue === '1');
    setAreStatsShown(showStatsValue === '1');
    setFilters(
      filtersFromQuery({ query: queryValue, attributes: attributes, schema: schemaValue }),
    );
    setTimeRange((prevTimeRange) => {
      if (!timeRangeStartValue || !timeRangeEndValue) {
        return undefined;
      }

      if (
        prevTimeRange?.start === timeRangeStartValue &&
        prevTimeRange?.end === timeRangeEndValue
      ) {
        return prevTimeRange;
      }

      return {
        start: timeRangeStartValue,
        end: timeRangeEndValue,
      };
    });
  }, [queryParams, attributes, config?.schema, initialQuery]);

  return {
    initialQuery,
    query,
    setQueryInURL,
    tenant,
    setTenantInURL,
    schema,
    setSchemaInURL,
    areResourcesShown,
    setShowResourcesInURL,
    areStatsShown,
    setShowStatsInURL,
    filters,
    setFilters,
    timeRange,
    setTimeRangeInURL,
    setDirectionInURL,
    timezone,
    setTimezoneInURL,
    attributes,
    direction,
    interval: timeRange ? intervalFromTimeRange(timeRange) : undefined,
  };
};
