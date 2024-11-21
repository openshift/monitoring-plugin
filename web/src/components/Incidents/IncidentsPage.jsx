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
import {
  getIncidentsTimeRanges,
  processIncidents,
  processIncidentsForAlerts,
} from './processIncidents';
import {
  filterIncident,
  onDeleteGroupIncidentFilterChip,
  onDeleteIncidentFilterChip,
  onIncidentTypeSelect,
  parseUrlParams,
  updateBrowserUrl,
} from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';
import {
  DropdownToggle as DropdownToggleDeprecated,
  Dropdown as DropdownDeprecated,
} from '@patternfly/react-core/deprecated';
import { CompressArrowsAltIcon, CompressIcon } from '@patternfly/react-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAlertsAreLoading,
  setAlertsData,
  setAlertsTableData,
  setIncidents,
  setIncidentsActiveFilters,
} from '../../actions/observe';
import { useLocation } from 'react-router-dom';
import { withFallback } from '../console/console-shared/error/error-boundary';
import { usePerspective } from '../hooks/usePerspective';

const IncidentsPage = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = parseUrlParams(location.search);
  const { perspective } = usePerspective();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = React.useState();
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

  const incidentsInitialState = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'incidentsInitialState']),
  );

  const incidents = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'incidents']),
  );

  const incidentsActiveFilters = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'incidentsActiveFilters']),
  );

  const incidentGroupId = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'incidentGroupId']),
  );

  const alertsData = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'alertsData']),
  );

  const alertsAreLoading = useSelector((state) =>
    state.plugins.monitoring.getIn(['incidentsData', 'alertsAreLoading']),
  );
  React.useEffect(() => {
    const hasUrlParams = Object.keys(urlParams).length > 0;

    if (hasUrlParams) {
      // If URL parameters exist, update incidentsActiveFilters based on them
      dispatch(
        setIncidentsActiveFilters({
          incidentsActiveFilters: {
            ...incidentsInitialState,
            ...urlParams,
          },
        }),
      );
    } else {
      // If no URL parameters exist, set the URL based on incidentsInitialState
      updateBrowserUrl(incidentsInitialState);
      dispatch(
        setIncidentsActiveFilters({
          incidentsActiveFilters: {
            ...incidentsInitialState,
          },
        }),
      );
    }
  }, []);

  React.useEffect(() => {
    updateBrowserUrl(incidentsActiveFilters);
  }, [incidentsActiveFilters]);

  React.useEffect(() => {
    setFilteredData(filterIncident(incidentsActiveFilters, incidents));
  }, [incidentsActiveFilters.incidentType]);

  const now = Date.now();
  const timeRanges = getIncidentsTimeRanges(daysSpan, now);
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  React.useEffect(() => {
    setDaysSpan(
      parsePrometheusDuration(
        incidentsActiveFilters.days.length > 0
          ? incidentsActiveFilters.days[0].split(' ')[0] + 'd'
          : '',
      ),
    );
  }, [incidentsActiveFilters.days]);

  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            createAlertsQuery(incidentForAlertProcessing),
            perspective,
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          dispatch(setAlertsData({ alertsData: processAlerts(aggregatedData) }));
          dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [incidentForAlertProcessing]);
  React.useEffect(() => {
    dispatch(
      setAlertsTableData({
        alertsTableData: groupAlertsForTable(alertsData),
      }),
    );
  }, [alertsAreLoading]);

  React.useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            'cluster:health:components:map',
            perspective,
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
          dispatch(
            setIncidents({
              incidents: processIncidents(aggregatedData),
            }),
          );
          setFilteredData(
            filterIncident(
              urlParams ? incidentsActiveFilters : incidentsInitialState,
              processIncidents(aggregatedData),
            ),
          );

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
          `cluster:health:components:map{group_id='${incidentGroupId}'}`,
          perspective,
        );
        return response.data.result;
      }),
    )
      .then((results) => {
        const aggregatedData = results.reduce((acc, result) => acc.concat(result), []);
        setIncidentForAlertProcessing(processIncidentsForAlerts(aggregatedData));
        dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
        setIncidentsAreLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);
      });
  }, [incidentGroupId]);

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
              onDeleteIncidentFilterChip('', '', incidentsActiveFilters, dispatch)
            }
          >
            <ToolbarContent>
              <ToolbarItem>
                <ToolbarFilter
                  chips={incidentsActiveFilters.incidentType}
                  deleteChip={(category, chip) =>
                    onDeleteIncidentFilterChip(category, chip, incidentsActiveFilters, dispatch)
                  }
                  deleteChipGroup={(category) =>
                    onDeleteGroupIncidentFilterChip(category, incidentsActiveFilters, dispatch)
                  }
                  categoryName="Incident type"
                >
                  <Select
                    variant={'checkbox'}
                    aria-label="Incident type"
                    onToggle={onIncidentFilterToggle}
                    onSelect={(event, selection) =>
                      onIncidentTypeSelect(event, selection, dispatch, incidentsActiveFilters)
                    }
                    selections={incidentsActiveFilters.incidentType}
                    isOpen={incidentFilterIsExpanded}
                    placeholderText="Incident type"
                    style={{
                      width: '350px',
                    }}
                  >
                    {incidentTypeMenuItems(incidentsActiveFilters)}
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
              <ToolbarItem>
                <DropdownDeprecated
                  dropdownItems={dropdownItems(t, dispatch, incidentsActiveFilters)}
                  isOpen={daysFilterIsExpanded}
                  onSelect={() => setDaysFilterIsExpanded(false)}
                  toggle={
                    <DropdownToggleDeprecated
                      id="incidents-page-days-filter-toggle"
                      onToggle={setDaysFilterIsExpanded}
                    >
                      {incidentsActiveFilters.days[0]}
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
            />
          )}
          <div className="row">
            <div className="col-xs-12">
              <IncidentsTable />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const incidentsPageWithFallback = withFallback(IncidentsPage);

export default incidentsPageWithFallback;
