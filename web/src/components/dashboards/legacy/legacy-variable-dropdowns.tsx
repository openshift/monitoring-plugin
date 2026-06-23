import {
  PrometheusEndpoint,
  PrometheusResponse,
  RedExclamationCircleIcon,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectOption,
  SelectOptionProps,
  Split,
  SplitItem,
  Stack,
  StackItem,
  Tooltip,
} from '@patternfly/react-core';
import * as _ from 'lodash-es';
import type { FC, Ref } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useSafeFetch } from '../../console/utils/safe-fetch-hook';
import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';
import { buildPrometheusUrl, getPrometheusBasePath } from '../../utils';

import {
  DataSource,
  isDataSource,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { StringParam, useQueryParam } from 'use-query-params';
import { useMonitoring } from '../../../hooks/useMonitoring';
import { dashboardsPatchVariable, dashboardsVariableOptionsLoaded } from '../../../store/actions';
import { MonitoringState } from '../../../store/store';
import { useDeepMemo } from '../../hooks/useDeepMemo';
import { getObserveState, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';
import { getTimeRanges, isTimeoutError, QUERY_CHUNK_SIZE } from '../../utils';
import {
  DEFAULT_GRAPH_SAMPLES,
  MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY,
  TimeRangeParam,
} from './utils';
import type { Variable } from './variable-utils';
import { evaluateVariableTemplate, isIntervalVariable } from './variable-utils';
export { evaluateVariableTemplate } from './variable-utils';
export type { Variable } from './variable-utils';

const LegacyDashboardsVariableOption = ({ value, isSelected, ...rest }: SelectOptionProps) =>
  isIntervalVariable(String(value)) ? (
    <Tooltip content={value}>
      <SelectOption value={value} isSelected={isSelected || false}>
        Auto interval
      </SelectOption>
    </Tooltip>
  ) : (
    <SelectOption value={value} isSelected={isSelected || false} {...rest}>
      {value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ? 'All' : value}
    </SelectOption>
  );

const LegacyDashboardsVariableDropdown: FC<VariableDropdownProps> = ({
  id,
  name,
  dashboardName,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin, accessCheckLoading, useMetricsTenancy } = useMonitoring();
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();
  const [queryParam, setQueryParam] = useQueryParam(name, StringParam);

  const [timespan] = useQueryParam(QueryParams.TimeRange, TimeRangeParam);

  const variables = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).dashboards.legacy[dashboardName]?.variables || {},
  );
  const variable = variables?.[name] as Variable;

  const options = useDeepMemo(() => {
    return variable?.options;
  }, [variable?.options]);

  const query = evaluateVariableTemplate(variable?.query, variables, timespan, namespace);

  const dispatch = useDispatch();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);

  const [isError, setIsError] = useState(false);

  const customDataSourceName = variable?.datasource?.name;
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSource>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  // Don't set namespace param while in dev perspective
  const shouldSetQueryParam = !(perspective === 'dev' && name === 'namespace');

  const getURL = useCallback(
    async (prometheusProps) => {
      try {
        if (!customDataSourceName) {
          return buildPrometheusUrl({
            prometheusUrlProps: prometheusProps,
            basePath: getPrometheusBasePath({
              prometheus: 'cmo',
              useTenancyPath: useMetricsTenancy,
            }),
          });
        } else if (extensionsResolved && hasExtensions) {
          const extension = extensions.find(
            (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
          );
          const getDataSource = extension?.properties?.getDataSource;
          const dataSource = await getDataSource?.(customDataSourceName);

          if (!dataSource || !dataSource.basePath) {
            setIsError(true);
            return;
          }
          return buildPrometheusUrl({
            prometheusUrlProps: prometheusProps,
            basePath: getPrometheusBasePath({
              prometheus: 'cmo',
              useTenancyPath: useMetricsTenancy,
              basePathOverride: dataSource?.basePath,
            }),
          });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setIsError(true);
      }
    },
    [customDataSourceName, extensions, extensionsResolved, hasExtensions, useMetricsTenancy],
  );

  useEffect(() => {
    if (!query || accessCheckLoading) {
      return;
    }
    // Convert label_values queries to something Prometheus can handle
    // TODO: Once the Prometheus /series endpoint is available through the API proxy, this should
    // be converted to use that instead
    const prometheusQuery = query.replace(/label_values\((.*), (.*)\)/, 'count($1) by ($2)');

    const timeRanges = getTimeRanges(timespan);
    const newOptions = new Set<string>();
    let abortError = false;
    dispatch(dashboardsPatchVariable(dashboardName, name, { isLoading: true }));
    Promise.allSettled(
      timeRanges.map(async (timeRange) => {
        const prometheusProps = {
          endpoint: PrometheusEndpoint.QUERY_RANGE,
          query: prometheusQuery,
          samples: Math.ceil(DEFAULT_GRAPH_SAMPLES / timeRanges.length),
          timeout: '60s',
          timespan: timeRange.duration,
          namespace,
          endTime: timeRange.endTime,
        };
        return getURL(prometheusProps).then((url) =>
          safeFetch<PrometheusResponse>(url)
            .then(({ data }) => {
              const responseOptions = _.flatMap(data?.result, ({ metric }) => _.values(metric));
              responseOptions.forEach(newOptions.add, newOptions);
            })
            .catch((err) => {
              if (isTimeoutError(err)) {
                // eslint-disable-next-line no-console
                console.error(
                  `Timed Out Retrieving Labels from ${new Date(
                    timeRange.endTime - QUERY_CHUNK_SIZE,
                  ).toISOString()} - ${new Date(timeRange.endTime).toISOString()} for ${query}`,
                );
              } else if (err.name === 'AbortError') {
                abortError = true;
              } else {
                // eslint-disable-next-line no-console
                console.error(err);
              }
            }),
        );
      }),
    ).then((results) => {
      const errors = results.filter((result) => result.status === 'rejected').length > 0;
      if (newOptions.size > 0 || !errors) {
        setIsError(false);
        // Options were found or no options were found but that wasn't in error
        const newOptionArray = Array.from(newOptions).sort();
        dispatch(dashboardsVariableOptionsLoaded(dashboardName, name, newOptionArray));
      } else {
        // No options were found, and there were errors (timeouts or other) in fetching the data
        dispatch(dashboardsPatchVariable(dashboardName, name, { isLoading: false }));
        if (!abortError) {
          setIsError(true);
        }
      }
    });
  }, [
    dispatch,
    getURL,
    dashboardName,
    name,
    namespace,
    query,
    safeFetch,
    timespan,
    variable?.includeAll,
    options,
    accessCheckLoading,
  ]);

  useEffect(() => {
    // Wait to set variable and query values until all options have been loaded
    if (variable?.value !== queryParam && options?.length > 0) {
      // Default to using the query param to allow for sharable links
      if (queryParam && options?.includes(queryParam)) {
        dispatch(dashboardsPatchVariable(dashboardName, name, { value: queryParam }));
        // set the url if it isn't set
      } else if (variable?.value && shouldSetQueryParam) {
        setQueryParam(variable?.value);
      }
    }
  }, [
    dashboardName,
    name,
    variable?.value,
    queryParam,
    setQueryParam,
    dispatch,
    shouldSetQueryParam,
    options,
  ]);

  const onChange = useCallback(
    (v: string) => {
      if (v !== variable?.value && shouldSetQueryParam) {
        setQueryParam(v);
        dispatch(dashboardsPatchVariable(dashboardName, name, { value: v }));
      }
    },
    [dispatch, dashboardName, name, variable?.value, setQueryParam, shouldSetQueryParam],
  );

  if (variable?.isHidden || (!isError && _.isEmpty(variable?.options))) {
    return null;
  }

  const items = (
    variable?.includeAll
      ? [{ value: MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY, children: 'All' }]
      : []
  ).concat(
    _.map(variable?.options, (option) => ({
      value: option,
      children: option,
    })),
  );

  return (
    <SplitItem>
      <Stack data-test={`${name.toLowerCase()}-dropdown`}>
        <StackItem>
          <label htmlFor={`${id}-dropdown`} style={{ textTransform: 'capitalize' }}>
            {name}
          </label>
        </StackItem>
        <StackItem>
          {isError ? (
            <Select
              toggle={(toggleRef: Ref<MenuToggleElement>) => (
                <MenuToggle ref={toggleRef} isDisabled={true} onClick={(e) => e.preventDefault()}>
                  <RedExclamationCircleIcon /> {t('Error loading options')}
                </MenuToggle>
              )}
            />
          ) : (
            <SingleTypeaheadDropdown
              items={items}
              onChange={onChange}
              OptionComponent={LegacyDashboardsVariableOption}
              selectedKey={variable?.value}
              hideClearButton
              resizeToFit
              placeholder={t('Select a dashboard from the dropdown')}
            />
          )}
        </StackItem>
      </Stack>
    </SplitItem>
  );
};

// Expects to be inside of a Patternfly Split Component
export const LegacyDashboardsAllVariableDropdowns: FC<{ dashboardName: string }> = ({
  dashboardName,
}) => {
  const { plugin } = useMonitoring();

  const variables = useSelector(
    (state: MonitoringState) =>
      getObserveState(plugin, state).dashboards.legacy[dashboardName]?.variables || {},
  );

  if (!variables || Object.keys(variables).length === 0) {
    return null;
  }

  return (
    <Split hasGutter isWrappable>
      {Object.keys(variables).map((name: string) => (
        <LegacyDashboardsVariableDropdown
          id={name}
          key={`${dashboardName}-${name}`}
          name={name}
          dashboardName={dashboardName}
        />
      ))}
    </Split>
  );
};

type VariableDropdownProps = {
  id: string;
  name: string;
  dashboardName: string;
};
