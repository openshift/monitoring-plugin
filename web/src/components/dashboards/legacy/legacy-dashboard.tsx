import classNames from 'classnames';
import * as _ from 'lodash-es';
import {
  RedExclamationCircleIcon,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  Card as PFCard,
  CardBody,
  CardHeader,
  CardTitle,
  DropdownItem,
} from '@patternfly/react-core';
import { AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import {
  CustomDataSource,
  DataSource as DataSourceExtension,
  isDataSource,
} from '../../console/extensions/dashboard-data-source';
import { setQueryArguments } from '../../console/utils/router';
import { LoadingInline } from '../../console/utils/status-box';

import { Perspective } from '../../../actions/observe';
import BarChart from '../legacy/bar-chart';
import Graph from '../legacy/graph';
import SingleStat from '../legacy/single-stat';
import Table from '../legacy/table';
import { useBoolean } from '../../hooks/useBoolean';
import { useIsVisible } from '../../hooks/useIsVisible';
import {
  getMutlipleQueryBrowserUrl,
  getLegacyObserveState,
  usePerspective,
} from '../../hooks/usePerspective';
import KebabDropdown from '../../kebab-dropdown';
import { MonitoringState } from '../../../reducers/observe';
import { evaluateVariableTemplate } from '../shared/variable-dropdowns';
import { Panel, Row } from './types';

const QueryBrowserLink = ({
  queries,
  customDataSourceName,
}: {
  queries: Array<string>;
  customDataSourceName: string;
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  const params = new URLSearchParams();
  queries.forEach((q, i) => params.set(`query${i}`, q));
  const [namespace] = useActiveNamespace();

  if (customDataSourceName) {
    params.set('datasource', customDataSourceName);
  }

  return (
    <Link aria-label={t('Inspect')} to={getMutlipleQueryBrowserUrl(perspective, params, namespace)}>
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
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [namespace] = useActiveNamespace();
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'pollInterval']),
  );
  const timespan = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespan']),
  );
  const variables = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'variables']),
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
  const queries = rawQueries.map((expr) => evaluateVariableTemplate(expr, variables, timespan));
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
        <CardHeader
          actions={{
            actions: (
              <>
                {!isLoading && (
                  <QueryBrowserLink queries={queries} customDataSourceName={customDataSourceName} />
                )}
                {panel.type === 'graph' && isThereCsvData() && (
                  <KebabDropdown dropdownItems={dropdownItems} />
                )}
              </>
            ),
            hasNoOffset: false,
            className: 'co-overview-card__actions',
          }}
          className="monitoring-dashboards__card-header"
        >
          <CardTitle>{panel.title}</CardTitle>
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
          className="pf-v5-m-link--align-left"
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

export const LegacyDashboard: React.FC<BoardProps> = ({ rows, perspective }) => (
  <>
    {_.map(rows, (row) => (
      <PanelsRow key={_.map(row.panels, 'id').join()} row={row} perspective={perspective} />
    ))}
  </>
);

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
