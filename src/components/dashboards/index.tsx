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
  TimeDropdownsProps,
} from './types';
import { useBoolean } from '../hooks/useBoolean';
import { useIsVisible } from '../hooks/useIsVisible';
import { useFetchDashboards } from './useFetchDashboards';
import {
  DEFAULT_GRAPH_SAMPLES,
  getActivePerspective,
  getAllVariables,
} from './monitoring-dashboard-utils';

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
  const { t } = useTranslation('public');

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
      {_.map(filteredItems, (v, k) => (
        <OptionComponent key={k} itemKey={k} />
      ))}
    </Select>
  );
};

const VariableOption = ({ itemKey }) =>
  isIntervalVariable(itemKey) ? (
    <Tooltip content={itemKey}>
      <SelectOption key={itemKey} value={itemKey}>
        Auto interval
      </SelectOption>
    </Tooltip>
  ) : (
    <SelectOption key={itemKey} value={itemKey}>
      {itemKey === MONITORING_DASHBOARDS_VARIABLE_ALL_OPTION_KEY ? 'All' : itemKey}
    </SelectOption>
  );

const VariableDropdown: React.FC<VariableDropdownProps> = ({ id, name, namespace }) => {
  const { t } = useTranslation('public');

  const activePerspective = getActivePerspective(namespace);

  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'timespan']),
  );

  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'variables']),
  );
  const variable = variables.toJS()[name];
  const query = evaluateTemplate(variable.query, variables, timespan);

  const dispatch = useDispatch();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const [isError, setIsError] = React.useState(false);

  const customDataSourceName = variable?.datasource?.name;
  // const [extensions] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const [extensions, extensionsResolved, extensionErrors] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  console.log("JZ variablesDropDown > customDataSourceName: " + JSON.stringify(customDataSourceName));
  console.log("JZ VariablesDropDown > extensions: " + JSON.stringify(extensions));
  console.log("JZ VariablesDropDown > extensionsResolved: " + JSON.stringify(extensionsResolved));
  console.log("JZ VariablesDropDown > extensionErrors: " + JSON.stringify(extensionErrors));


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
          const dataSource = await getDataSource(customDataSourceName);
          return getPrometheusURL(prometheusProps, dataSource?.basePath);
        }
      } catch (error) {
        setIsError(true);
      }
    },
    [customDataSourceName, extensions, extensionsResolved, hasExtensions],
  );

  React.useEffect(() => {
    if (query) {
      // Convert label_values queries to something Prometheus can handle
      // TODO: Once the Prometheus /series endpoint is available through the API proxy, this should
      // be converted to use that instead
      const prometheusQuery = query.replace(/label_values\((.*), (.*)\)/, 'count($1) by ($2)');

      const prometheusProps = {
        endpoint: PrometheusEndpoint.QUERY_RANGE,
        query: prometheusQuery,
        samples: DEFAULT_GRAPH_SAMPLES,
        timeout: '60s',
        timespan,
        namespace,
      };

      dispatch(dashboardsPatchVariable(name, { isLoading: true }, activePerspective));

      getURL(prometheusProps).then((url) =>
        safeFetch(url)
          .then(({ data }) => {
            setIsError(false);
            const newOptions = _.flatMap(data?.result, ({ metric }) => _.values(metric)).sort();
            dispatch(dashboardsVariableOptionsLoaded(name, newOptions, activePerspective));
          })
          .catch((err) => {
            dispatch(dashboardsPatchVariable(name, { isLoading: false }, activePerspective));
            if (err.name !== 'AbortError') {
              setIsError(true);
            }
          }),
      );
    }
  }, [activePerspective, dispatch, getURL, name, namespace, query, safeFetch, timespan]);

  React.useEffect(() => {
    if (variable.value && variable.value !== getQueryArgument(name)) {
      if (activePerspective === 'dev' && name !== 'namespace') {
        setQueryArgument(name, variable.value);
      } else if (activePerspective === 'admin') {
        setQueryArgument(name, variable.value);
      }
    }
  }, [activePerspective, name, variable.value]);

  const onChange = React.useCallback(
    (v: string) => {
      if (v !== variable.value) {
        if (activePerspective === 'dev' && name !== 'namespace') {
          setQueryArgument(name, v);
        } else if (activePerspective === 'admin') {
          setQueryArgument(name, v);
        }
        dispatch(dashboardsPatchVariable(name, { value: v }, activePerspective));
      }
    },
    [activePerspective, dispatch, name, variable.value],
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
        <FilterSelect
          items={items}
          onChange={onChange}
          OptionComponent={VariableOption}
          selectedKey={variable.value}
        />
      )}
    </div>
  );
};

const AllVariableDropdowns = () => {
  const namespace = React.useContext(NamespaceContext);
  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', getActivePerspective(namespace), 'variables']),
  );

  return (
    <>
      {variables.keySeq().map((name: string) => (
        <VariableDropdown key={name} id={name} name={name} namespace={namespace} />
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
    const { t } = useTranslation('public');

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

export const PollIntervalDropdown: React.FC<TimeDropdownsProps> = ({ namespace }) => {
  const { t } = useTranslation('public');

  const refreshIntervalFromParams = getQueryArgument('refreshInterval');
  const activePerspective = getActivePerspective(namespace);
  const interval = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'pollInterval']),
  );

  const dispatch = useDispatch();
  const setInterval = React.useCallback(
    (v: number) => {
      if (v) {
        setQueryArgument('refreshInterval', v.toString());
      } else {
        removeQueryArgument('refreshInterval');
      }
      dispatch(dashboardsSetPollInterval(v, activePerspective));
    },
    [dispatch, activePerspective],
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
  const namespace = React.useContext(NamespaceContext);
  return (
    <div className="monitoring-dashboards__options">
      <TimespanDropdown namespace={namespace} />
      <PollIntervalDropdown namespace={namespace} />
    </div>
  );
});

const HeaderTop: React.FC = React.memo(() => {
  const { t } = useTranslation('public');

  return (
    <div className="monitoring-dashboards__header">
      <h1 className="co-m-pane__heading">
        <span>{t('Dashboards')}</span>
      </h1>
      <TimeDropdowns />
    </div>
  );
});

const QueryBrowserLink = ({ queries }) => {
  const { t } = useTranslation('public');

  const params = new URLSearchParams();
  queries.forEach((q, i) => params.set(`query${i}`, q));
  const namespace = React.useContext(NamespaceContext);

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

const Card: React.FC<CardProps> = React.memo(({ panel }) => {
  const { t } = useTranslation('public');

  const namespace = React.useContext(NamespaceContext);
  const activePerspective = getActivePerspective(namespace);
  const pollInterval = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'pollInterval']),
  );
  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'timespan']),
  );
  const variables = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'variables']),
  );

  const ref = React.useRef();
  const [, wasEverVisible] = useIsVisible(ref);

  const [isError, setIsError] = React.useState<boolean>(false);
  const [dataSourceInfoLoading, setDataSourceInfoLoading] = React.useState<boolean>(true);
  const [customDataSource, setCustomDataSource] = React.useState<CustomDataSource>(undefined);
  const customDataSourceName = panel.datasource?.name;
  // const [extensions] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const [extensions, extensionsResolved, extensionErrors] = useResolvedExtensions<DataSourceExtension>(isDataSource);
  const hasExtensions = !_.isEmpty(extensions);

  console.log("JZ CARD > customDataSource", customDataSource)
  console.log("JZ  CARD > customDataSourceName", customDataSourceName)
  console.log("JZ  CARD > extensions", extensions)
  console.log("JZ  CARD > extensionsResolved", extensionsResolved)
  console.log("JZ  CARD > extensionErrors", extensionErrors)
  console.log("JZ  CARD > hasExtensions", hasExtensions)


  React.useEffect(() => {
    const getCustomDataSource = async () => {
      if (!customDataSourceName) {
        console.warn("JZ !customDataSourceName")
        setDataSourceInfoLoading(false);
        setCustomDataSource(null);
      } else if (!extensionsResolved) {
        console.warn("JZ !extensionsResolved")
        setDataSourceInfoLoading(true);
      } else if (hasExtensions) {
        console.warn("JZ hasExtensions")
        const extension = extensions.find(
          (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
        );
        const getDataSource = extension?.properties?.getDataSource;
        console.warn("JZ getDataSource: ",getDataSource )
        
        // JZ:TODO add this to other getDataSources to check for empty case 
        const dataSource = await getDataSource?.(customDataSourceName);
        console.warn("JZ dataSource: ", dataSource )
        setCustomDataSource(dataSource);
        setDataSourceInfoLoading(false);
      } else {
        console.warn("extensionErrors: ", extensionErrors)
        setDataSourceInfoLoading(false);
        setIsError(true);
      }
    };
    getCustomDataSource().catch((err) => {
      // JZ:TODO add this to other try catches
      // eslint-disable-next-line no-console
      console.error(err)
      setIsError(true);
    });
  }, [extensions, extensionsResolved, customDataSourceName, hasExtensions]);


//   const getCustomDataSource = async () => {
//     if (!customDataSourceName) {
//       setDataSourceInfoLoading(false);
//       setCustomDataSource(null);
//     } else if (dataSourceResolved) {
      
//     }  
//     else if (dataSourceResolved) {
//       setDataSourceInfoLoading(true);
//       const extension = extensions.find(
//         (ext) => ext?.properties?.contextId === 'monitoring-dashboards',
//       );
//       const getDataSource = extension?.properties?.getDataSource;
//       const dataSource = await getDataSource(customDataSourceName);
//       setCustomDataSource(dataSource);
//       setDataSourceInfoLoading(false);
//     } else {
//       console.log("JZ else statement")
//       // setDataSourceInfoLoading(false);
//       // setIsError(true);
//     }
//   };
//   getCustomDataSource().catch(() => {
//     setIsError(true);
//   });
// }, [dataSourceExtensions, customDataSourceName, hasExtensions]);



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
          <Card key={p.id} panel={p} />
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

  return (
    <div
      className={`monitoring-dashboards__panel monitoring-dashboards__panel--${panelClassModifier}`}
    >
      <PFCard
        className={classNames('monitoring-dashboards__card', {
          'co-overview-card--gradient': panel.type === 'grafana-piechart-panel',
        })}
        data-test={`${panel.title.toLowerCase().replace(/\s+/g, '-')}-chart`}
      >
        <CardHeader className="monitoring-dashboards__card-header">
          <CardTitle>{panel.title} JZ-TESTING: CUSTOM DASHBOARDS </CardTitle>
          <CardActions className="co-overview-card__actions">
            {!isLoading && <QueryBrowserLink queries={queries} />}
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

const PanelsRow: React.FC<{ row: Row }> = ({ row }) => {
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
            <Card key={panel.id} panel={panel} />
          ))}
        </div>
      )}
    </div>
  );
};

const Board: React.FC<BoardProps> = ({ rows }) => (
  <>
    {_.map(rows, (row) => (
      <PanelsRow key={_.map(row.panels, 'id').join()} row={row} />
    ))}
  </>
);

type MonitoringDashboardsPageProps = RouteComponentProps<{ board: string; ns?: string }>;

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({ history, match }) => {
  const { t } = useTranslation('public');

  const dispatch = useDispatch();
  const namespace = match.params?.ns;
  const activePerspective = getActivePerspective(namespace);
  const [board, setBoard] = React.useState<string>();
  const [boards, isLoading, error] = useFetchDashboards(namespace);

  // Clear queries on unmount
  React.useEffect(() => () => dispatch(queryBrowserDeleteAllQueries()), [dispatch]);

  // Clear variables on unmount for dev perspective
  React.useEffect(
    () => () => {
      if (activePerspective === 'dev') {
        dispatch(DashboardsClearVariables(activePerspective));
      }
    },
    [activePerspective, dispatch],
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
        dispatch(dashboardsPatchAllVariables(allVariables, activePerspective));

        // Set time range and poll interval options to their defaults or from the query params if
        // available
        if (refreshInterval) {
          dispatch(dashboardsSetPollInterval(_.toNumber(refreshInterval), activePerspective));
        }
        dispatch(dashboardsSetEndTime(_.toNumber(endTime) || null, activePerspective));
        dispatch(
          dashboardsSetTimespan(
            _.toNumber(timeSpan) || MONITORING_DASHBOARDS_DEFAULT_TIMESPAN,
            activePerspective,
          ),
        );

        setBoard(newBoard);
      }
    },
    [activePerspective, board, boards, dispatch, history, namespace],
  );

  // Display dashboard present in the params or show the first board
  React.useEffect(() => {
    if (!board && !_.isEmpty(boards)) {
      const boardName = getQueryArgument('dashboard');
      changeBoard((namespace ? boardName : match.params.board) || boards?.[0]?.name);
    }
  }, [board, boards, changeBoard, match.params.board, namespace]);

  React.useEffect(() => {
    const newBoard = getQueryArgument('dashboard');
    const allVariables = getAllVariables(boards, newBoard, namespace);
    dispatch(dashboardsPatchAllVariables(allVariables, activePerspective));
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
              <AllVariableDropdowns key={board} />
            </div>
            {namespace && <TimeDropdowns />}
          </div>
        </div>
        <Overview>{isLoading ? <LoadingInline /> : <Board key={board} rows={rows} />}</Overview>
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
  OptionComponent: React.FC<{ itemKey: string }>;
  selectedKey: string;
};

type VariableDropdownProps = {
  id: string;
  name: string;
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
};

type CardProps = {
  panel: Panel;
};

export default withFallback(MonitoringDashboardsPage);
