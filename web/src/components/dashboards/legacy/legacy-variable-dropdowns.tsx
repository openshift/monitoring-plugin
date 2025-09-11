import * as _ from 'lodash-es';
import {
  PrometheusEndpoint,
  PrometheusResponse,
  RedExclamationCircleIcon,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Tooltip,
  Select,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
  Stack,
  StackItem,
  SplitItem,
  Split,
} from '@patternfly/react-core';
import type { FC, Ref } from 'react';
import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { SingleTypeaheadDropdown } from '../../console/utils/single-typeahead-dropdown';
import { getPrometheusBasePath, buildPrometheusUrl } from '../../utils';
import { getQueryArgument, setQueryArgument } from '../../console/utils/router';
import { useSafeFetch } from '../../console/utils/safe-fetch-hook';

import { dashboardsPatchVariable, dashboardsVariableOptionsLoaded } from '../../../store/actions';
import { getTimeRanges, isTimeoutError, QUERY_CHUNK_SIZE } from '../../utils';
import { getObserveState } from '../../hooks/usePerspective';
import { MonitoringState } from '../../../store/store';
import { DEFAULT_GRAPH_SAMPLES, MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY } from './utils';
import {
  DataSource,
  isDataSource,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { useMonitoring } from '../../../hooks/useMonitoring';
import { useDeepMemo } from '../../hooks/useDeepMemo';

const intervalVariableRegExps = ['__interval', '__rate_interval', '__auto_interval_[a-z]+'];

const isIntervalVariable = (itemKey: string): boolean =>
  _.some(intervalVariableRegExps, (re) => itemKey?.match(new RegExp(`\\$${re}`, 'g')));

export const evaluateVariableTemplate = (
  template: string,
  variables: any,
  timespan: number,
): string => {
  if (_.isEmpty(template)) {
    return undefined;
  }

  const range: Variable = { value: `${Math.floor(timespan / 1000)}s` };
  const allVariables = {
    ...variables,
    __range: range,
    /* eslint-disable camelcase */
    __range_ms: range,
    __range_s: range,
    /* eslint-enable camelcase */
  };

  // Handle the special "interval" variables
  const intervalMS = timespan / DEFAULT_GRAPH_SAMPLES;
  const intervalMinutes = Math.floor(intervalMS / 1000 / 60);
  // Use a minimum of 5m to make sure we have enough data to perform `irate` calculations, which
  // require 2 data points each. Otherwise, there could be gaps in the graph.
  const interval: Variable = { value: `${Math.max(intervalMinutes, 5)}m` };
  // Add these last to ensure they are applied after other variable substitutions (because the other
  // variable substitutions may result in interval variables like $__interval being inserted)
  intervalVariableRegExps.forEach((k) => (allVariables[k] = interval));

  let result = template;
  _.each(allVariables, (v, k) => {
    const re = new RegExp(`\\$${k}`, 'g');
    if (result.match(re)) {
      if (v.isLoading) {
        result = undefined;
        return false;
      }
      const replacement =
        v.value === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ? '.+' : v.value || '';
      result = result.replace(re, replacement);
    }
  });

  return result;
};

const LegacyDashboardsVariableOption = ({ value, isSelected, ...rest }) =>
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

const LegacyDashboardsVariableDropdown: FC<VariableDropdownProps> = ({ id, name, namespace }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { plugin } = useMonitoring();

  const timespan = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).dashboards.timespan,
  );

  const variables = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).dashboards.variables,
  );
  const variable = variables?.[name] as Variable;
  const options = useDeepMemo(() => {
    return variable?.options;
  }, [variable?.options]);

  const query = evaluateVariableTemplate(variable?.query, variables, timespan);

  const dispatch = useDispatch();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);

  const [isError, setIsError] = useState(false);

  const customDataSourceName = variable?.datasource?.name;
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSource>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  const getURL = useCallback(
    async (prometheusProps) => {
      try {
        if (!customDataSourceName) {
          return buildPrometheusUrl({
            prometheusUrlProps: prometheusProps,
            basePath: getPrometheusBasePath({ prometheus: 'cmo' }),
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
    [customDataSourceName, extensions, extensionsResolved, hasExtensions],
  );

  useEffect(() => {
    if (!query) {
      return;
    }
    // Convert label_values queries to something Prometheus can handle
    // TODO: Once the Prometheus /series endpoint is available through the API proxy, this should
    // be converted to use that instead
    const prometheusQuery = query.replace(/label_values\((.*), (.*)\)/, 'count($1) by ($2)');

    const timeRanges = getTimeRanges(timespan);
    const newOptions = new Set<string>();
    let abortError = false;
    dispatch(dashboardsPatchVariable(name, { isLoading: true }));
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
        dispatch(dashboardsVariableOptionsLoaded(name, newOptionArray));
      } else {
        // No options were found, and there were errors (timeouts or other) in fetching the data
        dispatch(dashboardsPatchVariable(name, { isLoading: false }));
        if (!abortError) {
          setIsError(true);
        }
      }
    });
  }, [
    dispatch,
    getURL,
    name,
    namespace,
    query,
    safeFetch,
    timespan,
    variable?.includeAll,
    options,
  ]);

  useEffect(() => {
    if (variable?.value && variable?.value !== getQueryArgument(name)) {
      setQueryArgument(name, variable?.value);
    }
  }, [name, variable?.value]);

  const onChange = useCallback(
    (v: string) => {
      if (v !== variable?.value) {
        setQueryArgument(name, v);
        dispatch(dashboardsPatchVariable(name, { value: v }));
      }
    },
    [dispatch, name, variable?.value],
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
export const LegacyDashboardsAllVariableDropdowns: FC = () => {
  const [namespace] = useActiveNamespace();
  const { plugin } = useMonitoring();

  const variables = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).dashboards.variables,
  );

  if (!variables) {
    return null;
  }

  return (
    <Split hasGutter isWrappable>
      {Object.keys(variables).map((name: string) => (
        <LegacyDashboardsVariableDropdown id={name} key={name} name={name} namespace={namespace} />
      ))}
    </Split>
  );
};

export type Variable = {
  isHidden?: boolean;
  isLoading?: boolean;
  includeAll?: boolean;
  options?: string[];
  query?: string;
  value?: string;
  datasource?: any;
};

type VariableDropdownProps = {
  id: string;
  name: string;
  namespace?: string;
};
