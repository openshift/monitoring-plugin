/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import {
  ListPageFilter,
  PrometheusEndpoint,
  useListPageFilter,
} from '@openshift-console/dynamic-plugin-sdk';
import { parsePrometheusDuration } from '../console/utils/datetime';
import { getPrometheusURL } from '../console/graphs/helpers';
import { createAlertsQuery } from './api';
import { useTranslation } from 'react-i18next';
import {
  Bullseye,
  Dropdown,
  DropdownPosition,
  DropdownToggle,
  Flex,
  Select,
  SelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { useBoolean } from '../hooks/useBoolean';
import some from 'lodash-es/some';
import { daysMenuItems, dropdownItems, statusMenuItems } from './consts';
import { IncidentsTable } from './IncidentsTable';
import { getIncidentsTimeRanges, processIncidents } from './processIncidents';
import {
  filterIncident,
  onDeleteGroupIncidentFilterChip,
  onDeleteIncidentFilterChip,
} from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';

const IncidentsPage = ({ customDataSource, namespace = '#ALL_NS#' }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  const [alertsAreLoading, setAlertsAreLoading] = React.useState(true);
  // alerts data that we fetch from the prom db
  const [alertsData, setAlertsData] = React.useState([]);
  // all incidents data without filtering
  const [incidentsData, setIncidentsData] = React.useState([]);
  // data that we serve to the table, formatted to our needs
  const [tableData, setTableData] = React.useState([]);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = React.useState();
  // stores group id for the chosen incident. It trigger a fetch for alerts based on that incident
  const [chooseIncident, setChooseIncident] = React.useState('');
  // data that is filtered by the incidentType filter
  const [filteredData, setFilteredData] = React.useState([]);
  // data that is used for processing to serve it to the alerts table and chart
  const [incidentForAlertProcessing, setIncidentForAlertProcessing] = React.useState([]);
  const [filters, setFilters] = React.useState({
    days: ['7 days'],
    incidentType: [],
  });

  const now = Date.now();
  const timeRanges = getIncidentsTimeRanges(daysSpan, now);
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  React.useEffect(() => {
    setFilters({ days: ['7 days'], incidentType: filters.incidentType });
  }, []);

  React.useEffect(() => {
    setDaysSpan(
      parsePrometheusDuration(filters.days.length > 0 ? filters.days[0].split(' ')[0] + 'd' : ''),
    );
  }, [filters.days]);

  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await safeFetch(
            getPrometheusURL(
              {
                endpoint: PrometheusEndpoint.QUERY_RANGE,
                endTime: range.endTime,
                namespace,
                query: createAlertsQuery(incidentForAlertProcessing),
                samples: 24,
                timespan: range.duration - 1,
              },
              customDataSource?.basePath,
            ),
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          setAlertsData(processAlerts(aggregatedData));
          setAlertsAreLoading(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [incidentForAlertProcessing]);
  React.useEffect(() => {
    setTableData(groupAlertsForTable(alertsData));
  }, [alertsAreLoading]);

  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await safeFetch(
            getPrometheusURL(
              {
                endpoint: PrometheusEndpoint.QUERY_RANGE,
                endTime: range.endTime,
                namespace,
                query: 'cluster:health:components:map',
                samples: 24,
                timespan: range.duration - 1,
              },
              customDataSource?.basePath,
            ),
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          setIncidentsData(processIncidents(aggregatedData));
          setIncidentsAreLoading(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [daysSpan]);

  React.useEffect(() => {
    Promise.all(
      timeRanges.map(async (range) => {
        const response = await safeFetch(
          getPrometheusURL(
            {
              endpoint: PrometheusEndpoint.QUERY_RANGE,
              endTime: range.endTime,
              namespace,
              query: `cluster:health:components:map{group_id='${chooseIncident}'}`,
              samples: 24,
              timespan: range.duration - 1,
            },
            customDataSource?.basePath,
          ),
        );
        return response.data.result;
      }),
    )
      .then((results) => {
        const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
        setIncidentForAlertProcessing(processIncidents(aggregatedData));
        setAlertsAreLoading(true);
        setIncidentsAreLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, [chooseIncident]);

  const [incidentFilterIsExpanded, setIncidentIsExpanded] = React.useState(false);
  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = React.useState(false);

  const onIncidentFilterToggle = (isExpanded) => {
    setIncidentIsExpanded(isExpanded);
  };
  const onDaysFilterToggle = (isExpanded) => {
    setDaysFilterIsExpanded(isExpanded);
  };

  const onIncidentTypeSelect = (event, selection) => {
    onSelect('incidentType', event, selection);
  };
  const onDaysSelect = (event, selection) => {
    onSelect('days', event, selection);
  };

  const onSelect = (type, event, selection) => {
    const checked = event.target.checked;
    setFilters((prev) => {
      const prevSelections = prev[type];
      return {
        ...prev,
        [type]: checked
          ? [...prevSelections, selection]
          : prevSelections.filter((value) => value !== selection),
      };
    });
  };

  React.useEffect(() => {
    setFilteredData(filterIncident(filters, incidentsData));
  }, [filters.incidentType]);
  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      {alertsAreLoading && incidentsAreLoading ? (
        <Bullseye>
          <Spinner aria-label="incidents-chart-spinner" />
        </Bullseye>
      ) : (
        <div className="co-m-pane__body">
          <Toolbar
            id="toolbar-with-filter"
            className="pf-m-toggle-group-container"
            collapseListedFiltersBreakpoint="xl"
            clearAllFilters={() => onDeleteIncidentFilterChip('', '', filters, setFilters)}
          >
            <ToolbarContent>
              <ToolbarItem>
                <ToolbarFilter
                  chips={filters.incidentType}
                  deleteChip={(category, chip) =>
                    onDeleteIncidentFilterChip(category, chip, filters, setFilters)
                  }
                  deleteChipGroup={(category) =>
                    onDeleteGroupIncidentFilterChip(category, filters, setFilters)
                  }
                  categoryName="Incident type"
                >
                  <Select
                    variant={'checkbox'}
                    aria-label="Incident type"
                    onToggle={onIncidentFilterToggle}
                    onSelect={onIncidentTypeSelect}
                    selections={filters.incidentType}
                    isOpen={incidentFilterIsExpanded}
                    placeholderText="Incident type"
                    style={{
                      width: '350px',
                    }}
                  >
                    {statusMenuItems(filters)}
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
              <ToolbarItem>
                <ToolbarFilter
                  chips={filters.days}
                  deleteChip={(category, chip) =>
                    onDeleteIncidentFilterChip(category, chip, filters, setFilters)
                  }
                  deleteChipGroup={(category) =>
                    onDeleteGroupIncidentFilterChip(category, filters, setFilters)
                  }
                  categoryName="Days"
                >
                  <Select
                    variant={'checkbox'}
                    aria-label="Days"
                    onToggle={onDaysFilterToggle}
                    onSelect={onDaysSelect}
                    selections={filters.days}
                    isOpen={daysFilterIsExpanded}
                    placeholderText="Date range"
                  >
                    {daysMenuItems(filters)}
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
          <IncidentsHeader
            alertsData={alertsData}
            incidentsData={incidentsData} //should be filteredData
            chartDays={timeRanges.length}
            onIncidentSelect={setChooseIncident}
          />
          <div className="row">
            <div className="col-xs-12">
              <IncidentsTable loaded={!alertsAreLoading} data={tableData} namespace={namespace} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IncidentsPage;
