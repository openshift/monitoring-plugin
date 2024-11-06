/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
import { IncidentsHeader } from './IncidentsHeader/IncidentsHeader';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { parsePrometheusDuration } from '../console/utils/datetime';
import { createAlertsQuery, fetchDataForIncidentsAndAlerts } from './api';
import { useTranslation } from 'react-i18next';
import {
  Bullseye,
  Button,
  Select,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarItem,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { dropdownItems, incidentTypeMenuItems } from './consts';
import { IncidentsTable } from './IncidentsTable';
import { getIncidentsTimeRanges, processIncidents } from './processIncidents';
import {
  filterIncident,
  onDeleteGroupIncidentFilterChip,
  onDeleteIncidentFilterChip,
} from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';
import {
  DropdownToggle as DropdownToggleDeprecated,
  Dropdown as DropdownDeprecated,
} from '@patternfly/react-core/deprecated';
import { CompressArrowsAltIcon, CompressIcon } from '@patternfly/react-icons';
import { useDispatch, useSelector } from 'react-redux';
import { setIncidentsNavFilters } from '../../actions/observe';

const IncidentsPage = ({ customDataSource, namespace = '#ALL_NS#' }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const dispatch = useDispatch();
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
  const [hideCharts, setHideCharts] = React.useState(false);

  const [incidentFilterIsExpanded, setIncidentIsExpanded] = React.useState(false);
  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = React.useState(false);

  const onIncidentFilterToggle = (isExpanded) => {
    setIncidentIsExpanded(isExpanded);
  };
  const incidentsFiltersState = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'incidentsFilters']),
  );

  const onIncidentTypeSelect = (event, selection) => {
    onSelect('incidentType', event, selection);
  };

  const onSelect = (type, event, selection) => {
    const checked = event.target.checked;

    dispatch((dispatch) => {
      const prevSelections = incidentsFiltersState[type] || [];

      const updatedSelections = checked
        ? [...prevSelections, selection]
        : prevSelections.filter((value) => value !== selection);

      dispatch(
        setIncidentsNavFilters({
          incidentsFilters: {
            ...incidentsFiltersState,
            [type]: updatedSelections,
          },
        }),
      );
    });
  };

  React.useEffect(() => {
    setFilteredData(filterIncident(incidentsFiltersState, incidentsData));
  }, [incidentsFiltersState.incidentType]);

  const changeDaysFilter = (days) => {
    dispatch(
      setIncidentsNavFilters({
        incidentsFilters: { days: [days], incidentType: incidentsFiltersState.incidentType },
      }),
    );
  };

  const now = Date.now();
  const timeRanges = getIncidentsTimeRanges(daysSpan, now);
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  React.useEffect(() => {
    setDaysSpan(
      parsePrometheusDuration(
        incidentsFiltersState.days.length > 0
          ? incidentsFiltersState.days[0].split(' ')[0] + 'd'
          : '',
      ),
    );
  }, [incidentsFiltersState.days]);

  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            namespace,
            customDataSource,
            createAlertsQuery(incidentForAlertProcessing),
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
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            namespace,
            customDataSource,
            'cluster:health:components:map',
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          setIncidentsData(processIncidents(aggregatedData));
          setFilteredData(filterIncident(incidentsFiltersState, processIncidents(aggregatedData)));

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
        const response = await fetchDataForIncidentsAndAlerts(
          safeFetch,
          range,
          namespace,
          customDataSource,
          `cluster:health:components:map{group_id='${chooseIncident}'}`,
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
            clearAllFilters={() =>
              onDeleteIncidentFilterChip('', '', incidentsFiltersState, dispatch)
            }
          >
            <ToolbarContent>
              <ToolbarItem>
                <ToolbarFilter
                  chips={incidentsFiltersState.incidentType}
                  deleteChip={(category, chip) =>
                    onDeleteIncidentFilterChip(category, chip, incidentsFiltersState, dispatch)
                  }
                  deleteChipGroup={(category) =>
                    onDeleteGroupIncidentFilterChip(category, incidentsFiltersState, dispatch)
                  }
                  categoryName="Incident type"
                >
                  <Select
                    variant={'checkbox'}
                    aria-label="Incident type"
                    onToggle={onIncidentFilterToggle}
                    onSelect={onIncidentTypeSelect}
                    selections={incidentsFiltersState.incidentType}
                    isOpen={incidentFilterIsExpanded}
                    placeholderText="Incident type"
                    style={{
                      width: '350px',
                    }}
                  >
                    {incidentTypeMenuItems(incidentsFiltersState)}
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
              <ToolbarItem>
                <DropdownDeprecated
                  dropdownItems={dropdownItems(changeDaysFilter, t)}
                  isOpen={daysFilterIsExpanded}
                  onSelect={() => setDaysFilterIsExpanded(false)}
                  toggle={
                    <DropdownToggleDeprecated
                      id="incidents-page-days-filter-toggle"
                      onToggle={setDaysFilterIsExpanded}
                    >
                      {incidentsFiltersState.days[0]}
                    </DropdownToggleDeprecated>
                  }
                />
              </ToolbarItem>
              <ToolbarItem className="pf-m-align-right">
                <Button
                  variant="link"
                  icon={hideCharts ? <CompressArrowsAltIcon /> : <CompressIcon />}
                  onClick={() => setHideCharts(!hideCharts)}
                >
                  <span>Hide graph</span>
                </Button>
              </ToolbarItem>
            </ToolbarContent>
          </Toolbar>
          {hideCharts ? (
            ''
          ) : (
            <IncidentsHeader
              alertsData={alertsData}
              incidentsData={filteredData}
              chartDays={timeRanges.length}
              onIncidentSelect={setChooseIncident}
            />
          )}
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
