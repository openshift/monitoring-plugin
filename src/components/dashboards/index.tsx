import classNames from 'classnames';
import * as _ from 'lodash-es';
import {
  Overview,
  PrometheusEndpoint,
  RedExclamationCircleIcon,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Label,
  Select,
  SelectOption,
  Card as PFCard,
  CardBody,
  CardHeader,
  CardTitle,
  CardActions,
  Tooltip,
  DropdownItem,
} from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Map as ImmutableMap } from 'immutable';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';

import { withFallback } from '../console/console-shared/error/error-boundary';
import {
  CustomDataSource,
  DataSource as DataSourceExtension,
  isDataSource,
} from '../console/extensions/dashboard-data-source';
import ErrorAlert from '../console/console-shared/alerts/error';
import { getPrometheusURL } from '../console/graphs/helpers';
import {
  getQueryArgument,
  removeQueryArgument,
  setQueryArgument,
  setQueryArguments,
} from '../console/utils/router';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { LoadingInline } from '../console/utils/status-box';

import {
  DashboardsClearVariables,
  dashboardsPatchAllVariables,
  dashboardsPatchVariable,
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
  dashboardsVariableOptionsLoaded,
  Perspective,
  queryBrowserDeleteAllQueries,
} from '../../actions/observe';
import IntervalDropdown from '../poll-interval-dropdown';
import { RootState } from '../types';
import BarChart from './bar-chart';
import Graph from './graph';
import SingleStat from './single-stat';
import Table from './table';
import TimespanDropdown from './timespan-dropdown';
import {
  MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
  MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY,
  Panel,
  Row,
} from './types';
import { useBoolean } from '../hooks/useBoolean';
import { useIsVisible } from '../hooks/useIsVisible';
import { useFetchDashboards } from './useFetchDashboards';
import { DEFAULT_GRAPH_SAMPLES, getAllVariables } from './monitoring-dashboard-utils';
import { getTimeRanges, isTimeoutError, QUERY_CHUNK_SIZE } from '../utils';
import { usePerspective } from '../hooks/usePerspective';
import KebabDropdown from '../kebab-dropdown';

const intervalVariableRegExps = ['__interval', '__rate_interval', '__auto_interval_[a-z]+'];

const isIntervalVariable = (itemKey: string): boolean =>
  _.some(intervalVariableRegExps, (re) => itemKey?.match(new RegExp(`\\$${re}`, 'g')));

const evaluateTemplate = (
  template: string,
  variables: ImmutableMap<string, Variable>,
  timespan: number,
): string => {
  if (_.isEmpty(template)) {
    return undefined;
  }

  const range: Variable = { value: `${Math.floor(timespan / 1000)}s` };
  const allVariables = {
    ...variables.toJS(),
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

const NamespaceContext = React.createContext('');

const FilterSelect: React.FC<FilterSelectProps> = ({
  items,
  onChange,
  OptionComponent,
  selectedKey,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const [isOpen, , open, close] = useBoolean(false);
  const [filterText, setFilterText] = React.useState<string>();

  const onSelect = (e, v: string): void => {
    onChange(v);
    close();
    setFilterText(undefined);
  };

  const onToggle = (isExpanded: boolean) => {
    if (isExpanded) {
      open();
    } else {
      close();
      setFilterText(undefined);
    }
  };

  // filterText is lower-cased before being saved in state
  const filteredItems = filterText
    ? _.pickBy(items, (v) => v.toLowerCase().includes(filterText))
    : items;

  return (
    <Select
      className="monitoring-dashboards__variable-dropdown"
      hasInlineFilter={_.size(items) > 1}
      inlineFilterPlaceholderText={t('Filter options')}
      isOpen={isOpen}
      onFilter={() => null}
      onSelect={onSelect}
      onToggle={onToggle}
      onTypeaheadInputChanged={(v) => setFilterText(v.toLowerCase())}
      placeholderText={
        Object.keys(items).includes(selectedKey) ? (
          isIntervalVariable(selectedKey) ? (
            'Auto interval'
          ) : (
            items[selectedKey]
          )
        ) : (
          <>
            <RedExclamationCircleIcon /> {t('Select a dashboard from the dropdown')}
          </>
        )
      }
    >
      {_.map(filteredItems, (v, k) => {
        if (OptionComponent) {
          return <OptionComponent key={k} itemKey={k} />;
        } else if (isIntervalVariable(k)) {
          return (
            <Tooltip content={k}>
              <SelectOption key={k} value={k}>
                Auto interval
              </SelectOption>
            </Tooltip>
          );
        } else {
          return (
            <SelectOption key={k} value={k}>
              {k === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ? 'All' : k}
            </SelectOption>
          );
        }
      })}
    </Select>
  );
};

const VariableDropdown: React.FC<VariableDropdownProps> = ({
  id,
  name,
  namespace,
  perspective,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'timespan']),
  );

  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'variables']),
  );
  const variable = variables.toJS()[name];
  const query = evaluateTemplate(variable.query, variables, timespan);

  const dispatch = useDispatch();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const [isError, setIsError] = React.useState(false);

  const customDataSourceName = variable?.datasource?.name;
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  const getURL = React.useCallback(
    async (prometheusProps) => {
      try {
        if (!customDataSourceName) {
          return getPrometheusURL(prometheusProps);
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
          return getPrometheusURL(prometheusProps, dataSource?.basePath);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setIsError(true);
      }
    },
    [customDataSourceName, extensions, extensionsResolved, hasExtensions],
  );

  React.useEffect(() => {
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
    dispatch(dashboardsPatchVariable(name, { isLoading: true }, perspective));
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
          safeFetch(url)
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
        dispatch(dashboardsVariableOptionsLoaded(name, newOptionArray, perspective));
      } else {
        // No options were found, and there were errors (timeouts or other) in fetching the data
        dispatch(dashboardsPatchVariable(name, { isLoading: false }, perspective));
        if (!abortError) {
          setIsError(true);
        }
      }
    });
  }, [
    perspective,
    dispatch,
    getURL,
    name,
    namespace,
    query,
    safeFetch,
    timespan,
    variable.includeAll,
    variable.options,
  ]);

  React.useEffect(() => {
    if (variable.value && variable.value !== getQueryArgument(name)) {
      if (perspective === 'dev' && name !== 'namespace') {
        setQueryArgument(name, variable.value);
      } else if (perspective === 'admin') {
        setQueryArgument(name, variable.value);
      }
    }
  }, [perspective, name, variable.value]);

  const onChange = React.useCallback(
    (v: string) => {
      if (v !== variable.value) {
        if (perspective === 'dev' && name !== 'namespace') {
          setQueryArgument(name, v);
        } else if (perspective === 'admin') {
          setQueryArgument(name, v);
        }
        dispatch(dashboardsPatchVariable(name, { value: v }, perspective));
      }
    },
    [perspective, dispatch, name, variable.value],
  );

  if (variable.isHidden || (!isError && _.isEmpty(variable.options))) {
    return null;
  }

  const items = variable.includeAll
    ? { [MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY]: 'All' }
    : {};
  _.each(variable.options, (option) => {
    items[option] = option;
  });

  return (
    <div
      className="form-group monitoring-dashboards__dropdown-wrap"
      data-test={`${name.toLowerCase()}-dropdown`}
    >
      <label htmlFor={`${id}-dropdown`} className="monitoring-dashboards__dropdown-title">
        {name}
      </label>
      {isError ? (
        <Select
          isDisabled={true}
          onToggle={
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            () => {}
          }
          placeholderText={
            <>
              <RedExclamationCircleIcon /> {t('Error loading options')}
            </>
          }
        />
      ) : (
        <FilterSelect items={items} onChange={onChange} selectedKey={variable.value} />
      )}
    </div>
  );
};

const AllVariableDropdowns: React.FC<{ perspective: Perspective }> = ({ perspective }) => {
  const namespace = React.useContext(NamespaceContext);
  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'variables']),
  );

  return (
    <>
      {variables.keySeq().map((name: string) => (
        <VariableDropdown
          key={name}
          id={name}
          name={name}
          namespace={namespace}
          perspective={perspective}
        />
      ))}
    </>
  );
};

type TagColor = 'red' | 'purple' | 'blue' | 'green' | 'cyan' | 'orange';
const tagColors: TagColor[] = ['red', 'purple', 'blue', 'green', 'cyan', 'orange'];

const Tag: React.FC<{ color: TagColor; text: string }> = React.memo(({ color, text }) => (
  <Label className="monitoring-dashboards__dashboard_dropdown_tag" color={color}>
    {text}
  </Label>
));

const DashboardDropdown: React.FC<DashboardDropdownProps> = React.memo(
  ({ items, onChange, selectedKey }) => {
    const { t } = useTranslation('plugin__monitoring-plugin');

    const allTags = _.flatMap(items, 'tags');
    const uniqueTags = _.uniq(allTags);

    const OptionComponent = ({ itemKey }) => (
      <SelectOption className="monitoring-dashboards__dashboard_dropdown_item" value={itemKey}>
        {items[itemKey]?.title}
        {items[itemKey]?.tags?.map((tag, i) => (
          <Tag
            color={tagColors[_.indexOf(uniqueTags, tag) % tagColors.length]}
            key={i}
            text={tag}
          />
        ))}
      </SelectOption>
    );

    const selectItems = _.mapValues(items, 'title');

    return (
      <div
        className="form-group monitoring-dashboards__dropdown-wrap"
        data-test="dashboard-dropdown"
      >
        <label
          className="monitoring-dashboards__dropdown-title"
          htmlFor="monitoring-board-dropdown"
        >
          {t('Dashboard')}
        </label>
        <FilterSelect
          items={selectItems}
          onChange={onChange}
          OptionComponent={OptionComponent}
          selectedKey={selectedKey}
        />
      </div>
    );
  },
);

export const PollIntervalDropdown: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const refreshIntervalFromParams = getQueryArgument('refreshInterval');
  const { perspective } = usePerspective();
  const interval = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'pollInterval']),
  );

  const dispatch = useDispatch();
  const setInterval = React.useCallback(
    (v: number) => {
      if (v) {
        setQueryArgument('refreshInterval', v.toString());
      } else {
        removeQueryArgument('refreshInterval');
      }
      dispatch(dashboardsSetPollInterval(v, perspective));
    },
    [dispatch, perspective],
  );

  return (
    <div className="form-group monitoring-dashboards__dropdown-wrap">
      <label htmlFor="refresh-interval-dropdown" className="monitoring-dashboards__dropdown-title">
        {t('Refresh interval')}
      </label>
      <IntervalDropdown
        id="refresh-interval-dropdown"
        interval={_.toNumber(refreshIntervalFromParams) || interval}
        setInterval={setInterval}
      />
    </div>
  );
};

const TimeDropdowns: React.FC = React.memo(() => {
  return (
    <div className="monitoring-dashboards__options">
      <TimespanDropdown />
      <PollIntervalDropdown />
    </div>
  );
});

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <div className="monitoring-dashboards__header">
      <h1 className="co-m-pane__heading">
        <span>{t('Dashboards')}</span>
      </h1>
      <TimeDropdowns />
    </div>
  );
});

const QueryBrowserLink = ({
  queries,
  customDataSourceName,
}: {
  queries: Array<string>;
  customDataSourceName: string;
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const params = new URLSearchParams();
  queries.forEach((q, i) => params.set(`query${i}`, q));
  const namespace = React.useContext(NamespaceContext);

  if (customDataSourceName) {
    params.set('datasource', customDataSourceName);
  }

  return (
    <Link
      aria-label={t('Inspect')}
      to={
        namespace
          ? `/dev-monitoring/ns/${namespace}/metrics?${params.toString()}`
          : `/monitoring/query-browser?${params.toString()}`
      }
    >
      {t('Inspect')}
    </Link>
  );
};

// Determine how many columns a panel should span. If panel specifies a `span`, use that. Otherwise
// look for a `breakpoint` percentage. If neither are specified, default to 12 (full width).
const getPanelSpan = (panel: Panel): number => {
  if (panel.span) {
    return panel.span;
  }
  const breakpoint = _.toInteger(_.trimEnd(panel.breakpoint, '%'));
  if (breakpoint > 0) {
    return Math.round(12 * (breakpoint / 100));
  }
  return 12;
};

const getPanelClassModifier = (panel: Panel): string => {
  const span: number = getPanelSpan(panel);
  switch (span) {
    case 6:
      return 'max-2';
    case 2:
    // fallthrough
    case 4:
    // fallthrough
    case 5:
      return 'max-3';
    case 3:
      return 'max-4';
    default:
      return 'max-1';
  }
};

const Card: React.FC<CardProps> = React.memo(({ panel, perspective }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const namespace = React.useContext(NamespaceContext);
  const pollInterval = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'pollInterval']),
  );
  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'timespan']),
  );
  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'variables']),
  );

  const ref = React.useRef();
  const [, wasEverVisible] = useIsVisible(ref);

  const [isError, setIsError] = React.useState<boolean>(false);
  const [dataSourceInfoLoading, setDataSourceInfoLoading] = React.useState<boolean>(true);
  const [customDataSource, setCustomDataSource] = React.useState<CustomDataSource>(undefined);
  const customDataSourceName = panel.datasource?.name;
  const [extensions, extensionsResolved] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  const formatSeriesTitle = React.useCallback(
    (labels, i) => {
      const title = panel.targets?.[i]?.legendFormat;
      if (_.isNil(title)) {
        return _.isEmpty(labels) ? '{}' : '';
      }
      // Replace Prometheus labels surrounded by {{ }} in the graph legend label templates
      // Regex is based on https://prometheus.io/docs/concepts/data_model/#metric-names-and-labels
      // with additional matchers to allow leading and trailing whitespace
      return title.replace(
        /{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g,
        (match, key) => labels[key] ?? '',
      );
    },
    [panel],
  );
  const [csvData, setCsvData] = React.useState([]);

  const csvExportHandler = () => {
    let csvString = '';
    const result = {};
    const seriesNames = [];
    for (let i = 0; i < csvData.length; i++) {
      const query = csvData[i];
      for (const series of query) {
        if (!series[0]) {
          continue;
        }
        const name = formatSeriesTitle(series[0], i);
        seriesNames.push(name);
        if (!name) {
          continue;
        }
        if (!Array.isArray(series[1])) {
          continue;
        }
        for (const entry of series[1]) {
          const dateTime = entry.x.toISOString();
          const value = entry.y;
          if (!result[dateTime]) {
            result[dateTime] = {};
          }
          result[dateTime][name] = value;
        }
      }
    }
    const uniqueSeriesNames = new Set(seriesNames);
    const uniqueSeriesArray = Array.from(uniqueSeriesNames);

    csvString = `DateTime,${uniqueSeriesArray.join(',')}\n`;

    for (const dateTime in result) {
      const temp = [];
      for (const name of uniqueSeriesArray) {
        temp.push(result[dateTime][name]);
      }
      csvString += `${dateTime},${temp.join(',')}\n`;
    }

    const blobCsvData = new Blob([csvString], { type: 'text/csv' });
    const csvURL = URL.createObjectURL(blobCsvData);
    const link = document.createElement('a');
    link.href = csvURL;
    link.download = `graphData.csv`;
    link.click();
  };

  const dropdownItems = [
    <DropdownItem key="action" component="button" onClick={csvExportHandler}>
      {t('Export as CSV')}
    </DropdownItem>,
  ];

  React.useEffect(() => {
    const getCustomDataSource = async () => {
      if (!customDataSourceName) {
        setDataSourceInfoLoading(false);
        setCustomDataSource(null);
      } else if (!extensionsResolved) {
        setDataSourceInfoLoading(true);
      } else if (hasExtensions) {
        const extension = extensions.find(
          (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
        );
        const getDataSource = extension?.properties?.getDataSource;
        const dataSource = await getDataSource?.(customDataSourceName);

        if (!dataSource || !dataSource.basePath) {
          setIsError(true);
          setDataSourceInfoLoading(false);
        } else {
          setCustomDataSource(dataSource);
          setDataSourceInfoLoading(false);
        }
      } else {
        setDataSourceInfoLoading(false);
        setIsError(true);
      }
    };
    getCustomDataSource().catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      setIsError(true);
    });
  }, [extensions, extensionsResolved, customDataSourceName, hasExtensions]);

  const handleZoom = React.useCallback((timeRange: number, endTime: number) => {
    setQueryArguments({
      endTime: endTime.toString(),
      timeRange: timeRange.toString(),
    });
  }, []);

  if (panel.type === 'row') {
    return (
      <>
        {_.map(panel.panels, (p) => (
          <Card key={p.id} panel={p} perspective={perspective} />
        ))}
      </>
    );
  }

  if (!['gauge', 'grafana-piechart-panel', 'graph', 'singlestat', 'table'].includes(panel.type)) {
    return null;
  }

  const rawQueries = _.map(panel.targets, 'expr');
  if (!rawQueries.length) {
    return null;
  }
  const queries = rawQueries.map((expr) => evaluateTemplate(expr, variables, timespan));
  const isLoading =
    (_.some(queries, _.isUndefined) && dataSourceInfoLoading) || customDataSource === undefined;

  const panelClassModifier = getPanelClassModifier(panel);

  const isThereCsvData = () => {
    if (csvData.length > 0) {
      if (csvData[0].length > 0) {
        return true;
      }
    }
    return false;
  };

  return (
    <div
      className={`monitoring-dashboards__panel monitoring-dashboards__panel--${panelClassModifier}`}
    >
      <PFCard
        className={classNames('monitoring-dashboards__card', {
          'co-overview-card--gradient': panel.type === 'grafana-piechart-panel',
        })}
        data-test={`${panel.title.toLowerCase().replace(/\s+/g, '-')}-chart`}
        data-test-id={panel.id ? `chart-${panel.id}` : undefined}
      >
        <CardHeader className="monitoring-dashboards__card-header">
          <CardTitle>{panel.title}</CardTitle>
          <CardActions className="co-overview-card__actions">
            {!isLoading && (
              <QueryBrowserLink queries={queries} customDataSourceName={customDataSourceName} />
            )}
            {panel.type === 'graph' && isThereCsvData() && (
              <KebabDropdown dropdownItems={dropdownItems} />
            )}
          </CardActions>
        </CardHeader>
        <CardBody className="co-dashboard-card__body--dashboard">
          {isError ? (
            <>
              <RedExclamationCircleIcon /> {t('Error loading card')}
            </>
          ) : (
            <div className="monitoring-dashboards__card-body-content" ref={ref}>
              {isLoading || !wasEverVisible ? (
                <div className={panel.type === 'graph' ? 'query-browser__wrapper' : ''}>
                  <LoadingInline />
                </div>
              ) : (
                <>
                  {panel.type === 'grafana-piechart-panel' && (
                    <BarChart
                      pollInterval={pollInterval}
                      query={queries[0]}
                      customDataSource={customDataSource}
                    />
                  )}
                  {panel.type === 'graph' && (
                    <Graph
                      formatSeriesTitle={formatSeriesTitle}
                      isStack={panel.stack}
                      pollInterval={pollInterval}
                      queries={queries}
                      showLegend={panel.legend?.show}
                      units={panel.yaxes?.[0]?.format}
                      onZoomHandle={handleZoom}
                      namespace={namespace}
                      customDataSource={customDataSource}
                      perspective={perspective}
                      onDataChange={(data) => setCsvData(data)}
                    />
                  )}
                  {(panel.type === 'singlestat' || panel.type === 'gauge') && (
                    <SingleStat
                      panel={panel}
                      pollInterval={pollInterval}
                      query={queries[0]}
                      namespace={namespace}
                      customDataSource={customDataSource}
                    />
                  )}
                  {panel.type === 'table' && (
                    <Table
                      panel={panel}
                      pollInterval={pollInterval}
                      queries={queries}
                      namespace={namespace}
                      customDataSource={customDataSource}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </CardBody>
      </PFCard>
    </div>
  );
});

const PanelsRow: React.FC<PanelsRowProps> = ({ row, perspective }) => {
  const showButton = row.showTitle && !_.isEmpty(row.title);

  const [isExpanded, toggleIsExpanded] = useBoolean(showButton ? !row.collapse : true);

  const Icon = isExpanded ? AngleDownIcon : AngleRightIcon;
  const title = isExpanded ? 'Hide' : 'Show';

  return (
    <div data-test-id={`panel-${_.kebabCase(row?.title)}`}>
      {showButton && (
        <Button
          aria-label={title}
          className="pf-m-link--align-left"
          onClick={toggleIsExpanded}
          style={{ fontSize: 24 }}
          title={title}
          variant="plain"
        >
          <Icon />
          &nbsp;{row.title}
        </Button>
      )}
      {isExpanded && (
        <div className="monitoring-dashboards__row">
          {_.map(row.panels, (panel) => (
            <Card key={panel.id} panel={panel} perspective={perspective} />
          ))}
        </div>
      )}
    </div>
  );
};

const Board: React.FC<BoardProps> = ({ rows, perspective }) => (
  <>
    {_.map(rows, (row) => (
      <PanelsRow key={_.map(row.panels, 'id').join()} row={row} perspective={perspective} />
    ))}
  </>
);

type MonitoringDashboardsPageProps = RouteComponentProps<{ board: string; ns?: string }>;

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ history, match }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const dispatch = useDispatch();
  const namespace = match.params?.ns;
  const { perspective } = usePerspective();
  const [board, setBoard] = React.useState<string>();
  const [boards, isLoading, error] = useFetchDashboards(namespace);

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  // Clear variables on unmount for dev perspective
  React.useEffect(
    () => () => {
      if (perspective === 'dev') {
        dispatch(DashboardsClearVariables(perspective));
      }
    },
    [perspective, dispatch],
  );

  const boardItems = React.useMemo(
    () =>
      _.mapValues(_.mapKeys(boards, 'name'), (b, name) => ({
        tags: b.data?.tags,
        title: b.data?.title ?? name,
      })),
    [boards],
  );

  const changeBoard = React.useCallback(
    (newBoard: string) => {
      let timeSpan: string;
      let endTime: string;
      let url = namespace
        ? `/dev-monitoring/ns/${namespace}?dashboard=${newBoard}`
        : `/monitoring/dashboards/${newBoard}`;

      const refreshInterval = getQueryArgument('refreshInterval');

      if (board) {
        timeSpan = null;
        endTime = null;
        // persist only the refresh Interval when dashboard is changed
        if (refreshInterval) {
          const params = new URLSearchParams({ refreshInterval });
          url = `${url}?${params.toString()}`;
        }
      } else {
        timeSpan = getQueryArgument('timeRange');
        endTime = getQueryArgument('endTime');
        // persist all query params on page reload
        if (window.location.search) {
          url = `${url}${window.location.search}`;
        }
      }
      if (newBoard !== board) {
        if (getQueryArgument('dashboard') !== newBoard) {
          history.replace(url);
        }

        const allVariables = getAllVariables(boards, newBoard, namespace);
        dispatch(dashboardsPatchAllVariables(allVariables, perspective));

        // Set time range and poll interval options to their defaults or from the query params if
        // available
        if (refreshInterval) {
          dispatch(dashboardsSetPollInterval(_.toNumber(refreshInterval), perspective));
        }
        dispatch(dashboardsSetEndTime(_.toNumber(endTime) || null, perspective));
        dispatch(
          dashboardsSetTimespan(
            _.toNumber(timeSpan) || MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
            perspective,
          ),
        );

        setBoard(newBoard);
      }
    },
    [perspective, board, boards, dispatch, history, namespace],
  );

  // Display dashboard present in the params or show the first board
  React.useEffect(() => {
    if (!board && !_.isEmpty(boards)) {
      const boardName = getQueryArgument('dashboard');
      changeBoard((namespace ? boardName : match.params.board) || boards?.[0]?.name);
    }
  }, [board, boards, changeBoard, match.params.board, namespace]);

  React.useEffect(() => {
    // Dashboard query argument is only set in dev perspective, so skip for admin
    if (perspective === 'admin') {
      return;
    }
    const newBoard = getQueryArgument('dashboard');
    const allVariables = getAllVariables(boards, newBoard, namespace);
    dispatch(dashboardsPatchAllVariables(allVariables, perspective));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  // If we don't find any rows, build the rows array based on what we have in `data.panels`
  const rows = React.useMemo(() => {
    const data = _.find(boards, { name: board })?.data;

    return data?.rows?.length
      ? data.rows
      : data?.panels?.reduce((acc, panel) => {
          if (panel.type === 'row') {
            acc.push(_.cloneDeep(panel));
          } else if (acc.length === 0) {
            acc.push({ panels: [panel] });
          } else {
            const row = acc[acc.length - 1];
            if (_.isNil(row.panels)) {
              row.panels = [];
            }
            row.panels.push(panel);
          }
          return acc;
        }, []);
  }, [board, boards]);

  if (error) {
    return <ErrorAlert message={error} />;
  }

  return (
    <>
      {!namespace && (
        <Helmet>
          <title>{t('Metrics dashboards')}</title>
        </Helmet>
      )}
      <NamespaceContext.Provider value={namespace}>
        <div className="co-m-nav-title co-m-nav-title--detail">
          {!namespace && <HeaderTop />}
          <div className="monitoring-dashboards__variables">
            <div className="monitoring-dashboards__dropdowns">
              {!_.isEmpty(boardItems) && (
                <DashboardDropdown items={boardItems} onChange={changeBoard} selectedKey={board} />
              )}
              <AllVariableDropdowns key={board} perspective={perspective} />
            </div>
            {namespace && <TimeDropdowns />}
          </div>
        </div>
        <Overview>
          {isLoading ? (
            <LoadingInline />
          ) : (
            <Board key={board} rows={rows} perspective={perspective} />
          )}
        </Overview>
      </NamespaceContext.Provider>
    </>
  );
};
const MonitoringDashboardsPage = withRouter(MonitoringDashboardsPage_);

type Variable = {
  isHidden?: boolean;
  isLoading?: boolean;
  options?: string[];
  query?: string;
  value?: string;
};

type FilterSelectProps = {
  items: { [key: string]: string };
  onChange: (v: string) => void;
  OptionComponent?: React.FC<{ itemKey: string }>;
  selectedKey: string;
};

type VariableDropdownProps = {
  id: string;
  name: string;
  perspective: Perspective;
  namespace?: string;
};

type DashboardDropdownProps = {
  items: {
    [key: string]: {
      tags: string[];
      title: string;
    };
  };
  onChange: (v: string) => void;
  selectedKey: string;
};

type BoardProps = {
  rows: Row[];
  perspective: Perspective;
};

type CardProps = {
  panel: Panel;
  perspective: Perspective;
};

type PanelsRowProps = {
  row: Row;
  perspective: Perspective;
};

export default withFallback(MonitoringDashboardsPage);
