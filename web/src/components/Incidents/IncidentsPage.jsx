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
  MenuToggle,
  Badge,
  SelectList,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { dropdownItems, incidentFiltersMenuItems } from './consts';
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
  onIncidentFiltersSelect,
  parseUrlParams,
  updateBrowserUrl,
  usePatternFlyTheme,
} from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';
import {
  DropdownToggle as DropdownToggleDeprecated,
  Dropdown as DropdownDeprecated,
} from '@patternfly/react-core/deprecated';
import { CompressArrowsAltIcon, CompressIcon, FilterIcon } from '@patternfly/react-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAlertsAreLoading,
  setAlertsData,
  setAlertsTableData,
  setFilteredIncidentsData,
  setIncidents,
  setIncidentsActiveFilters,
} from '../../actions/observe';
import { useLocation } from 'react-router-dom';
import { withFallback } from '../console/console-shared/error/error-boundary';
import { usePerspective } from '../hooks/usePerspective';

const IncidentsPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = parseUrlParams(location.search);
  const { perspective } = usePerspective();
  const { theme } = usePatternFlyTheme();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = React.useState();
  const [timeRanges, setTimeRanges] = React.useState([]);
  // data that is used for processing to serve it to the alerts table and chart
  const [incidentForAlertProcessing, setIncidentForAlertProcessing] = React.useState([]);
  const [hideCharts, setHideCharts] = React.useState(false);

  const [incidentFilterIsExpanded, setIncidentIsExpanded] = React.useState(false);
  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = React.useState(false);

  const onIncidentFilterToggle = () => {
    setIncidentIsExpanded(!incidentFilterIsExpanded);
  };
  const onToggleClick = () => {
    setDaysFilterIsExpanded(!daysFilterIsExpanded);
  };

  const incidentsInitialState = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsInitialState']),
  );

  const incidents = useSelector((state) => state.plugins.mcp.getIn(['incidentsData', 'incidents']));

  const incidentsActiveFilters = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsActiveFilters']),
  );

  const incidentGroupId = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentGroupId']),
  );

  const alertsData = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsData']),
  );

  const alertsAreLoading = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsAreLoading']),
  );

  const filteredData = useSelector((state) =>
    state.plugins.mcp.getIn(['incidentsData', 'filteredIncidentsData']),
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
    dispatch(
      setFilteredIncidentsData({
        filteredIncidentsData: filterIncident(incidentsActiveFilters, incidents),
      }),
    );
  }, [incidentsActiveFilters.incidentFilters]);

  const now = Date.now();
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  React.useEffect(() => {
    setTimeRanges(getIncidentsTimeRanges(daysSpan, now));
  }, [daysSpan]);

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
          dispatch(
            setFilteredIncidentsData({
              filteredIncidentsData: filterIncident(
                urlParams ? incidentsActiveFilters : incidentsInitialState,
                processIncidents(aggregatedData),
              ),
            }),
          );
          setIncidentsAreLoading(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [timeRanges]);

  React.useEffect(() => {
    if (incidentGroupId) {
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
    }
  }, [incidentGroupId, timeRanges]);

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
            className="pf-v5-m-toggle-group-container"
            collapseListedFiltersBreakpoint="xl"
            clearAllFilters={() =>
              onDeleteIncidentFilterChip('', '', incidentsActiveFilters, dispatch)
            }
          >
            <ToolbarContent>
              <ToolbarItem>
                <ToolbarFilter
                  chips={incidentsActiveFilters.incidentFilters}
                  deleteChip={(category, chip) =>
                    onDeleteIncidentFilterChip(category, chip, incidentsActiveFilters, dispatch)
                  }
                  deleteChipGroup={(category) =>
                    onDeleteGroupIncidentFilterChip(category, incidentsActiveFilters, dispatch)
                  }
                  categoryName="Filters"
                >
                  <Select
                    role="menu"
                    aria-label="Filters"
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={onIncidentFilterToggle}
                        isExpanded={incidentFilterIsExpanded}
                      >
                        <FilterIcon /> Filters
                        {Object.entries(incidentsActiveFilters.incidentFilters).length > 0 && (
                          <Badge isRead>
                            {Object.entries(incidentsActiveFilters.incidentFilters).length}
                          </Badge>
                        )}
                      </MenuToggle>
                    )}
                    onSelect={(event, selection) =>
                      onIncidentFiltersSelect(event, selection, dispatch, incidentsActiveFilters)
                    }
                    onOpenChange={(isOpen) => setIncidentIsExpanded(isOpen)}
                    selected={incidentsActiveFilters.incidentFilters}
                    isOpen={incidentFilterIsExpanded}
                  >
                    <SelectList>{incidentFiltersMenuItems(incidentsActiveFilters)}</SelectList>
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
              <ToolbarItem>
                <DropdownDeprecated
                  dropdownItems={dropdownItems(
                    t,
                    dispatch,
                    incidentsActiveFilters,
                    setIncidentsAreLoading,
                  )}
                  isOpen={daysFilterIsExpanded}
                  onSelect={() => setDaysFilterIsExpanded(false)}
                  toggle={
                    <DropdownToggleDeprecated
                      id="incidents-page-days-filter-toggle"
                      onToggle={onToggleClick}
                    >
                      {incidentsActiveFilters.days[0]}
                    </DropdownToggleDeprecated>
                  }
                />
              </ToolbarItem>
              <ToolbarItem align={{ default: 'alignRight' }}>
                <Button
                  variant="link"
                  icon={hideCharts ? <CompressArrowsAltIcon /> : <CompressIcon />}
                  onClick={() => setHideCharts(!hideCharts)}
                >
                  <span>{hideCharts ? t('Show graph') : t('Hide graph')}</span>
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
              theme={theme}
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
