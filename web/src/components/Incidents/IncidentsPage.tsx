/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, useState, useEffect } from 'react';
import { useSafeFetch } from '../console/utils/safe-fetch-hook';
import { createAlertsQuery, fetchDataForIncidentsAndAlerts } from './api';
import { useTranslation } from 'react-i18next';
import {
  Bullseye,
  Button,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  MenuToggle,
  PageSection,
  Stack,
  StackItem,
  ToolbarGroup,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
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
} from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';
import { CompressArrowsAltIcon, CompressIcon, FilterIcon } from '@patternfly/react-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAlertsAreLoading,
  setAlertsData,
  setAlertsTableData,
  setChooseIncident,
  setFilteredIncidentsData,
  setIncidentPageFilterType,
  setIncidents,
  setIncidentsActiveFilters,
} from '../../actions/observe';
import { useLocation } from 'react-router-dom';
import { getLegacyObserveState, usePerspective } from '../hooks/usePerspective';
import { changeDaysFilter } from './utils';
import { parsePrometheusDuration } from '../console/console-shared/src/datetime/prometheus';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import IncidentsChart from './IncidentsChart/IncidentsChart';
import AlertsChart from './AlertsChart/AlertsChart';
import { usePatternFlyTheme } from '../hooks/usePatternflyTheme';
import { MonitoringState } from 'src/reducers/observe';
import { Incident } from './model';
import { useAlertsPoller } from '../hooks/useAlertsPoller';
import { Rule } from '@openshift-console/dynamic-plugin-sdk';
import IncidentFilterToolbarItem, { severityOptions, stateOptions } from './ToolbarItemFilter';

const IncidentsPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = useMemo(() => parseUrlParams(location.search), [location.search]);
  const { perspective, rulesKey } = usePerspective();
  useAlertsPoller();
  const { theme } = usePatternFlyTheme();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = useState(true);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = useState<number>();
  const [timeRanges, setTimeRanges] = useState([]);
  // data that is used for processing to serve it to the alerts table and chart
  const [incidentForAlertProcessing, setIncidentForAlertProcessing] = useState<
    Array<Partial<Incident>>
  >([]);
  const [hideCharts, setHideCharts] = useState(false);

  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = useState(false);
  const [filterTypeIsExpanded, setFilterTypeIsExpanded] = useState(false);
  const [severityFilterExpanded, setSeverityFilterExpanded] = useState(false);
  const [stateFilterExpanded, setStateFilterExpanded] = useState(false);

  const onFilterTypeToggle = (ev) => {
    ev.stopPropagation();
    setFilterTypeIsExpanded(!filterTypeIsExpanded);
  };
  const onSeverityFilterToggle = (ev) => {
    ev.stopPropagation();
    setSeverityFilterExpanded(!severityFilterExpanded);
  };
  const onStateFilterToggle = (ev) => {
    ev.stopPropagation();
    setStateFilterExpanded(!stateFilterExpanded);
  };

  const onToggleClick = (ev) => {
    ev.stopPropagation();
    setDaysFilterIsExpanded(!daysFilterIsExpanded);
  };

  const incidentsInitialState = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsInitialState']),
  );

  const incidents = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidents']),
  );

  const incidentsActiveFilters = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentsActiveFilters']),
  );
  const incidentGroupId = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'groupId']),
  );
  const alertsData = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsData']),
  );
  const alertsAreLoading = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsAreLoading']),
  );

  const filteredData = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'filteredIncidentsData']),
  );

  const incidentPageFilterTypeSelected = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'incidentPageFilterType']),
  );

  useEffect(() => {
    const hasUrlParams = Object.keys(urlParams).length > 0;
    if (hasUrlParams) {
      // If URL parameters exist, update incidentsActiveFilters based on them
      dispatch(
        setIncidentsActiveFilters({
          incidentsActiveFilters: {
            days: urlParams.days ? urlParams.days : ['7 days'],
            severity: urlParams.severity ? urlParams.severity : [],
            state: urlParams.state ? urlParams.state : [],
          },
        }),
      );
      if (urlParams?.groupId?.length > 0) {
        dispatch(
          setChooseIncident({
            groupId: urlParams?.groupId?.at(0),
          }),
        );
      }
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

  useEffect(() => {
    updateBrowserUrl(incidentsActiveFilters, incidentGroupId);
  }, [incidentsActiveFilters]);

  useEffect(() => {
    dispatch(
      setFilteredIncidentsData({
        filteredIncidentsData: filterIncident(incidentsActiveFilters, incidents),
      }),
    );
  }, [incidentsActiveFilters.state, incidentsActiveFilters.severity]);

  const now = Date.now();
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  useEffect(() => {
    setTimeRanges(getIncidentsTimeRanges(daysSpan, now));
  }, [daysSpan]);

  useEffect(() => {
    setDaysSpan(
      parsePrometheusDuration(
        incidentsActiveFilters.days.length > 0
          ? incidentsActiveFilters.days[0].split(' ')[0] + 'd'
          : '',
      ),
    );
  }, [incidentsActiveFilters.days]);

  useEffect(() => {
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
          const aggregatedData = results.flat();
          dispatch(
            setAlertsData({
              alertsData: processAlerts(aggregatedData, incidentForAlertProcessing),
            }),
          );
          dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [incidentForAlertProcessing]);

  const alertingRulesData: Rule[] = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(rulesKey),
  );

  useEffect(() => {
    if (alertingRulesData && alertsData) {
      dispatch(
        setAlertsTableData({
          alertsTableData: groupAlertsForTable(alertsData, alertingRulesData),
        }),
      );
    }
  }, [alertsData, alertingRulesData]);

  useEffect(() => {
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
          const aggregatedData = results.flat();
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

  useEffect(() => {
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
          const aggregatedData = results.flat();
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

  const onSelect = (_event, value) => {
    if (value) {
      changeDaysFilter(value, dispatch, incidentsActiveFilters);
    }

    setDaysFilterIsExpanded(false);
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        {alertsAreLoading && incidentsAreLoading ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          <PageSection hasBodyWrapper={false}>
            <Toolbar
              id="toolbar-with-filter"
              collapseListedFiltersBreakpoint="xl"
              clearAllFilters={() =>
                dispatch(
                  setIncidentsActiveFilters({
                    incidentsActiveFilters: {
                      severity: [],
                      days: ['7 days'],
                      state: [],
                    },
                  }),
                )
              }
            >
              <ToolbarContent>
                <ToolbarGroup>
                  <ToolbarItem>
                    <Select
                      aria-label="Filter type selection"
                      isOpen={filterTypeIsExpanded}
                      role="menu"
                      selected={incidentPageFilterTypeSelected}
                      onOpenChange={(isOpen) => setFilterTypeIsExpanded(isOpen)}
                      onSelect={(event, selection) =>
                        dispatch(setIncidentPageFilterType({ incidentPageFilterType: selection }))
                      }
                      shouldFocusToggleOnSelect
                      toggle={(toggleRef) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={onFilterTypeToggle}
                          isExpanded={filterTypeIsExpanded}
                          icon={<FilterIcon />}
                        >
                          {incidentPageFilterTypeSelected}
                        </MenuToggle>
                      )}
                    >
                      <SelectOption
                        value="Severity"
                        isSelected={incidentPageFilterTypeSelected?.includes('Severity')}
                      >
                        Severity
                      </SelectOption>
                      <SelectOption
                        value="State"
                        isSelected={incidentPageFilterTypeSelected?.includes('State')}
                      >
                        State
                      </SelectOption>
                    </Select>
                  </ToolbarItem>
                  <ToolbarItem>
                    <IncidentFilterToolbarItem
                      categoryName="Severity"
                      toggleLabel="Severity filters"
                      options={severityOptions}
                      incidentsActiveFilters={incidentsActiveFilters}
                      onDeleteIncidentFilterChip={onDeleteIncidentFilterChip}
                      onDeleteGroupIncidentFilterChip={onDeleteGroupIncidentFilterChip}
                      incidentFilterIsExpanded={severityFilterExpanded}
                      onIncidentFiltersSelect={onIncidentFiltersSelect}
                      setIncidentIsExpanded={setSeverityFilterExpanded}
                      onIncidentFilterToggle={onSeverityFilterToggle}
                      dispatch={dispatch}
                      showToolbarItem={incidentPageFilterTypeSelected?.includes('Severity')}
                    />
                  </ToolbarItem>
                  <ToolbarItem>
                    <IncidentFilterToolbarItem
                      categoryName="State"
                      toggleLabel="State filters"
                      options={stateOptions}
                      incidentsActiveFilters={incidentsActiveFilters}
                      onDeleteIncidentFilterChip={onDeleteIncidentFilterChip}
                      onDeleteGroupIncidentFilterChip={onDeleteGroupIncidentFilterChip}
                      incidentFilterIsExpanded={stateFilterExpanded}
                      onIncidentFiltersSelect={onIncidentFiltersSelect}
                      setIncidentIsExpanded={setStateFilterExpanded}
                      onIncidentFilterToggle={onStateFilterToggle}
                      dispatch={dispatch}
                      showToolbarItem={incidentPageFilterTypeSelected?.includes('State')}
                    />
                  </ToolbarItem>
                </ToolbarGroup>
                <ToolbarItem align={{ default: 'alignEnd' }}>
                  <Stack>
                    <StackItem>
                      <span>Time range</span>
                    </StackItem>
                    <StackItem>
                      <Select
                        id="time-range-select"
                        isOpen={daysFilterIsExpanded}
                        selected={incidentsActiveFilters.days[0]}
                        onSelect={onSelect}
                        onOpenChange={(isOpen) => setDaysFilterIsExpanded(isOpen)}
                        toggle={(toggleRef) => (
                          <MenuToggle
                            ref={toggleRef}
                            onClick={onToggleClick}
                            isExpanded={daysFilterIsExpanded}
                          >
                            {`Last ${incidentsActiveFilters.days[0]}`}
                          </MenuToggle>
                        )}
                        shouldFocusToggleOnSelect
                      >
                        <SelectList>
                          <SelectOption value="1 day">{t('Last 1 day')}</SelectOption>
                          <SelectOption value="3 days">{t('Last 3 days')}</SelectOption>
                          <SelectOption value="7 days">{t('Last 7 days')}</SelectOption>
                          <SelectOption value="15 days">{t('Last 15 days')}</SelectOption>
                        </SelectList>
                      </Select>
                    </StackItem>
                  </Stack>
                </ToolbarItem>
              </ToolbarContent>
            </Toolbar>
            <Stack hasGutter>
              <StackItem>
                <Flex justifyContent={{ default: 'justifyContentFlexEnd' }}>
                  <FlexItem>
                    <Button
                      variant="link"
                      icon={hideCharts ? <CompressArrowsAltIcon /> : <CompressIcon />}
                      onClick={() => setHideCharts(!hideCharts)}
                    >
                      <span>{hideCharts ? t('Show graph') : t('Hide graph')}</span>
                    </Button>
                  </FlexItem>
                </Flex>
              </StackItem>
              {!hideCharts && (
                <>
                  <StackItem>
                    <IncidentsChart
                      incidentsData={filteredData}
                      chartDays={timeRanges.length}
                      theme={theme}
                    />
                  </StackItem>
                  <StackItem>
                    <AlertsChart chartDays={timeRanges.length} theme={theme} />
                  </StackItem>
                </>
              )}
              <StackItem>
                <IncidentsTable />
              </StackItem>
            </Stack>
          </PageSection>
        )}
      </PageSection>
    </>
  );
};

const incidentsPageWithFallback = withFallback(IncidentsPage);

export default incidentsPageWithFallback;
