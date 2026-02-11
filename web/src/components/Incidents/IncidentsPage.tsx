/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo, useState, useEffect, useCallback } from 'react';
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
  Alert,
  AlertActionCloseButton,
} from '@patternfly/react-core';
import { AccessDenied } from '../console/console-shared/src/components/empty-state/AccessDenied';
import { IncidentsTable } from './IncidentsTable';
import {
  getIncidentsTimeRanges,
  convertToIncidents,
  processIncidentsForAlerts,
} from './processIncidents';
import {
  filterIncident,
  getCurrentTime,
  getIncidentIdOptions,
  onDeleteGroupIncidentFilterChip,
  onDeleteIncidentFilterChip,
  onIncidentFiltersSelect,
  parseUrlParams,
  updateBrowserUrl,
} from './utils';
import { groupAlertsForTable, convertToAlerts } from './processAlerts';
import { CompressArrowsAltIcon, CompressIcon, FilterIcon } from '@patternfly/react-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAlertsAreLoading,
  setAlertsData,
  setAlertsTableData,
  setFilteredIncidentsData,
  setIncidentPageFilterType,
  setIncidents,
  setIncidentsActiveFilters,
  setIncidentsLastRefreshTime,
} from '../../store/actions';
import { useLocation } from 'react-router-dom';
import { changeDaysFilter } from './utils';
import { parsePrometheusDuration } from '../console/console-shared/src/datetime/prometheus';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import IncidentsChart from './IncidentsChart/IncidentsChart';
import AlertsChart from './AlertsChart/AlertsChart';
import { usePatternFlyTheme } from '../hooks/usePatternflyTheme';
import { MonitoringState } from '../../store/store';
import { Incident, IncidentsPageFiltersExpandedState } from './model';
import { useAlerts } from '../../hooks/useAlerts';
import IncidentFilterToolbarItem, {
  useSeverityOptions,
  useStateOptions,
} from './ToolbarItemFilter';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { isEmpty } from 'lodash-es';
import { DataTestIDs } from '../data-test';
import { DocumentTitle } from '@openshift-console/dynamic-plugin-sdk';

const IncidentsPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = useMemo(() => parseUrlParams(location.search), [location.search]);
  const { rules } = useAlerts({ dontUseTenancy: true });
  const { theme } = usePatternFlyTheme();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = useState<number>(0);
  const [timeRanges, setTimeRanges] = useState<Array<{ endTime: number; duration: number }>>([]);
  // data that is used for processing to serve it to the alerts table and chart
  const [incidentForAlertProcessing, setIncidentForAlertProcessing] = useState<
    Array<Partial<Incident>>
  >([]);
  const [hideCharts, setHideCharts] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const INCIDENTS_DATA_ALERT_DISPLAYED = 'monitoring/incidents/data-alert-displayed';
  const [showDataDelayAlert, setShowDataDelayAlert] = useState(() => {
    const alertDisplayed = localStorage.getItem(INCIDENTS_DATA_ALERT_DISPLAYED);
    return !alertDisplayed;
  });

  const [filtersExpanded, setFiltersExpanded] = useState<IncidentsPageFiltersExpandedState>({
    severity: false,
    state: false,
    groupId: false,
  });

  const [filterTypeExpanded, setFilterTypeExpanded] = useState({
    filterType: false,
  });

  const onFilterToggle = (
    ev: React.MouseEvent,
    filterName: keyof IncidentsPageFiltersExpandedState | 'filterType',
    setter,
  ) => {
    ev.stopPropagation();
    setter((prevFilters) => ({
      ...prevFilters,
      [filterName]: !prevFilters[filterName],
    }));
  };

  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = useState(false);

  const onToggleClick = (ev) => {
    ev.stopPropagation();
    setDaysFilterIsExpanded(!daysFilterIsExpanded);
  };

  const incidentsInitialState = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsInitialState,
  );

  const incidents = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData?.incidents,
  );

  const incidentsActiveFilters = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsActiveFilters,
  );

  const alertsAreLoading = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData?.alertsAreLoading,
  );

  const filteredData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.filteredIncidentsData,
  );

  const selectedGroupId = incidentsActiveFilters.groupId?.[0] ?? undefined;

  const incidentPageFilterTypeSelected = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentPageFilterType,
  );

  const incidentsLastRefreshTime = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsLastRefreshTime,
  );

  const closeDropDownFilters = (): void => {
    setFiltersExpanded({
      severity: false,
      state: false,
      groupId: false,
    });

    setFilterTypeExpanded({
      filterType: false,
    });
    setDaysFilterIsExpanded(false);
  };

  useEffect(() => {
    const hasUrlParams = Object.keys(urlParams).length > 0;
    if (hasUrlParams) {
      dispatch(
        setIncidentsActiveFilters({
          incidentsActiveFilters: {
            days: urlParams.days ? urlParams.days : ['7 days'],
            severity: urlParams.severity ? urlParams.severity : [],
            state: urlParams.state ? urlParams.state : [],
            groupId: urlParams.groupId ? urlParams.groupId : [],
          },
        }),
      );
    } else {
      updateBrowserUrl(incidentsInitialState);
      dispatch(
        setIncidentsActiveFilters({
          incidentsActiveFilters: {
            ...incidentsInitialState,
          },
        }),
      );
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    updateBrowserUrl(incidentsActiveFilters, selectedGroupId);
  }, [incidentsActiveFilters]);

  useEffect(() => {
    dispatch(
      setFilteredIncidentsData({
        filteredIncidentsData: filterIncident(incidentsActiveFilters, incidents),
      }),
    );
  }, [
    incidentsActiveFilters.state,
    incidentsActiveFilters.severity,
    incidentsActiveFilters.groupId,
  ]);

  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  useEffect(() => {
    setTimeRanges(getIncidentsTimeRanges(daysSpan, incidentsLastRefreshTime));
  }, [daysSpan, selectedGroupId, incidentsLastRefreshTime]);

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
      const currentTime = incidentsLastRefreshTime;
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            createAlertsQuery(incidentForAlertProcessing),
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const prometheusResults = results.flat();
          const alerts = convertToAlerts(
            prometheusResults,
            incidentForAlertProcessing,
            currentTime,
          );
          dispatch(
            setAlertsData({
              alertsData: alerts,
            }),
          );
          if (rules && alerts) {
            dispatch(
              setAlertsTableData({
                alertsTableData: groupAlertsForTable(alerts, rules),
              }),
            );
          }
          if (!isEmpty(filteredData)) {
            dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
          } else {
            dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);

          dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
          setLoadError(err);
        });
    })();
  }, [incidentForAlertProcessing]);

  useEffect(() => {
    if (!isInitialized) return;

    setIncidentsAreLoading(true);
    setLoadError(null);

    // Set refresh time before making queries
    const currentTime = getCurrentTime();
    dispatch(setIncidentsLastRefreshTime(currentTime));

    const daysDuration = parsePrometheusDuration(
      incidentsActiveFilters.days.length > 0
        ? incidentsActiveFilters.days[0].split(' ')[0] + 'd'
        : '',
    );
    const calculatedTimeRanges = getIncidentsTimeRanges(daysDuration, currentTime);

    const isGroupSelected = !!selectedGroupId;
    const incidentsQuery = isGroupSelected
      ? `cluster_health_components_map{group_id='${selectedGroupId}'}`
      : 'cluster_health_components_map';

    Promise.all(
      calculatedTimeRanges.map(async (range) => {
        const response = await fetchDataForIncidentsAndAlerts(safeFetch, range, incidentsQuery);
        return response.data.result;
      }),
    )
      .then((results) => {
        const prometheusResults = results.flat();
        const incidents = convertToIncidents(prometheusResults, currentTime);

        // Update the raw, unfiltered incidents state
        dispatch(setIncidents({ incidents }));

        // Filter the incidents and dispatch
        dispatch(
          setFilteredIncidentsData({
            filteredIncidentsData: filterIncident(incidentsActiveFilters, incidents),
          }),
        );

        setIncidentsAreLoading(false);

        if (isGroupSelected) {
          setIncidentForAlertProcessing(processIncidentsForAlerts(prometheusResults));
          dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
        } else {
          closeDropDownFilters();
          setIncidentForAlertProcessing([]);
          dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.log(err);

        setIncidentsAreLoading(false);
        dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
        setLoadError(err);
      });
  }, [isInitialized, incidentsActiveFilters.days, selectedGroupId]);

  const onSelect = (_event, value) => {
    if (value) {
      changeDaysFilter(value, dispatch, incidentsActiveFilters);
    }

    setDaysFilterIsExpanded(false);
  };

  const severityOptions = useSeverityOptions();
  const stateOptions = useStateOptions();
  const incidentIdFilterOptions = incidents ? getIncidentIdOptions(incidents, t) : [];

  useEffect(() => {
    //force a loading state for the alerts chart and table if we filtered out all of the incidents
    if (
      (!isEmpty(incidentsActiveFilters.severity) || !isEmpty(incidentsActiveFilters.state)) &&
      isEmpty(filteredData)
    ) {
      dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
    }

    if (!isEmpty(filteredData) && !isEmpty(incidentsActiveFilters.groupId)) {
      dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
    }
  }, [incidentsActiveFilters, filteredData, dispatch]);

  useEffect(() => {
    // Set up 5-minute timer to hide banner automatically on first visit
    if (showDataDelayAlert) {
      const timer = setTimeout(() => {
        setShowDataDelayAlert(false);
        localStorage.setItem(INCIDENTS_DATA_ALERT_DISPLAYED, 'true');
      }, 5 * 60 * 1000);

      return () => clearTimeout(timer);
    }
  }, [showDataDelayAlert]);

  const handleIncidentChartClick = useCallback(
    (groupId) => {
      closeDropDownFilters();

      if (groupId === selectedGroupId) {
        dispatch(
          setIncidentsActiveFilters({
            incidentsActiveFilters: {
              ...incidentsActiveFilters,
              groupId: [],
            },
          }),
        );
      } else {
        dispatch(
          setIncidentsActiveFilters({
            incidentsActiveFilters: {
              ...incidentsActiveFilters,
              groupId: [groupId],
            },
          }),
        );
      }
    },
    [dispatch, incidentsActiveFilters, selectedGroupId],
  );

  return (
    <>
      <DocumentTitle>{title}</DocumentTitle>
      {loadError ? (
        <AccessDenied message={loadError.message} />
      ) : alertsAreLoading && incidentsAreLoading ? (
        <Bullseye>
          <Spinner
            aria-label="incidents-chart-spinner"
            data-test={DataTestIDs.IncidentsPage.LoadingSpinner}
          />
        </Bullseye>
      ) : (
        !loadError && (
          <PageSection hasBodyWrapper={false} className="incidents-page-main-section">
            {showDataDelayAlert && (
              <Alert
                variant="info"
                title="Data delay"
                className="pf-v6-u-mb-md"
                actionClose={
                  <AlertActionCloseButton
                    aria-label="Close data delay alert"
                    onClose={() => {
                      setShowDataDelayAlert(false);
                      localStorage.setItem(INCIDENTS_DATA_ALERT_DISPLAYED, 'true');
                    }}
                  />
                }
              >
                {t(
                  'Incident data is updated every few minutes. What you see may be up to 5 minutes old. Refresh the page to view updated information.',
                )}
              </Alert>
            )}
            <Toolbar
              id="toolbar-with-filter"
              data-test={DataTestIDs.IncidentsPage.Toolbar}
              collapseListedFiltersBreakpoint="xl"
              clearFiltersButtonText={t('Clear all filters')}
              clearAllFilters={() => {
                closeDropDownFilters();
                dispatch(
                  setIncidentsActiveFilters({
                    incidentsActiveFilters: {
                      ...incidentsActiveFilters,
                      severity: [],
                      state: [],
                      groupId: [],
                    },
                  }),
                );
                dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
              }}
            >
              <ToolbarContent>
                <ToolbarGroup>
                  <ToolbarItem>
                    <Select
                      aria-label={t('Filter type selection')}
                      data-test={DataTestIDs.IncidentsPage.FiltersSelect}
                      isOpen={filterTypeExpanded.filterType}
                      role="menu"
                      selected={incidentPageFilterTypeSelected}
                      onOpenChange={(isOpen) =>
                        setFiltersExpanded((prev) => ({ ...prev, filterType: isOpen }))
                      }
                      onSelect={(event, selection) => {
                        dispatch(setIncidentPageFilterType({ incidentPageFilterType: selection }));
                        setFilterTypeExpanded((prev) => ({ ...prev, filterType: false }));
                      }}
                      shouldFocusToggleOnSelect
                      toggle={(toggleRef) => (
                        <MenuToggle
                          ref={toggleRef}
                          onClick={(ev) => onFilterToggle(ev, 'filterType', setFilterTypeExpanded)}
                          isExpanded={filterTypeExpanded.filterType}
                          icon={<FilterIcon />}
                          data-test={DataTestIDs.IncidentsPage.FiltersSelectToggle}
                        >
                          {t(incidentPageFilterTypeSelected)}
                        </MenuToggle>
                      )}
                      style={{ width: '145px' }}
                    >
                      <SelectList data-test={DataTestIDs.IncidentsPage.FiltersSelectList}>
                        <SelectOption
                          value="Severity"
                          isSelected={incidentPageFilterTypeSelected?.includes('Severity')}
                          data-test={`${DataTestIDs.IncidentsPage.FiltersSelectOption}-severity`}
                        >
                          {t('Severity')}
                        </SelectOption>
                        <SelectOption
                          value="State"
                          isSelected={incidentPageFilterTypeSelected?.includes('State')}
                          data-test={`${DataTestIDs.IncidentsPage.FiltersSelectOption}-state`}
                        >
                          {t('State')}
                        </SelectOption>
                        <SelectOption
                          value="Incident ID"
                          isSelected={incidentPageFilterTypeSelected?.includes('Incident ID')}
                          data-test={`${DataTestIDs.IncidentsPage.FiltersSelectOption}-incident-id`}
                        >
                          {t('Incident ID')}
                        </SelectOption>
                      </SelectList>
                    </Select>
                  </ToolbarItem>
                  <ToolbarItem
                    className={incidentPageFilterTypeSelected !== 'Severity' ? 'pf-m-hidden' : ''}
                  >
                    <IncidentFilterToolbarItem
                      categoryName="Severity"
                      toggleLabel={t('Severity filters')}
                      options={severityOptions}
                      incidentsActiveFilters={incidentsActiveFilters}
                      onDeleteIncidentFilterChip={onDeleteIncidentFilterChip}
                      onDeleteGroupIncidentFilterChip={onDeleteGroupIncidentFilterChip}
                      incidentFilterIsExpanded={filtersExpanded.severity}
                      onIncidentFiltersSelect={onIncidentFiltersSelect}
                      setIncidentIsExpanded={(isExpanded) =>
                        setFiltersExpanded((prev) => ({ ...prev, severity: isExpanded }))
                      }
                      onIncidentFilterToggle={(ev) =>
                        onFilterToggle(ev, 'severity', setFiltersExpanded)
                      }
                      dispatch={dispatch}
                      showToolbarItem={incidentPageFilterTypeSelected?.includes('Severity')}
                    />
                  </ToolbarItem>
                  <ToolbarItem
                    className={incidentPageFilterTypeSelected !== 'State' ? 'pf-m-hidden' : ''}
                  >
                    <IncidentFilterToolbarItem
                      categoryName="State"
                      toggleLabel={t('State filters')}
                      options={stateOptions}
                      incidentsActiveFilters={incidentsActiveFilters}
                      onDeleteIncidentFilterChip={onDeleteIncidentFilterChip}
                      onDeleteGroupIncidentFilterChip={onDeleteGroupIncidentFilterChip}
                      incidentFilterIsExpanded={filtersExpanded.state}
                      onIncidentFiltersSelect={onIncidentFiltersSelect}
                      setIncidentIsExpanded={(isExpanded) =>
                        setFiltersExpanded((prev) => ({ ...prev, state: isExpanded }))
                      }
                      onIncidentFilterToggle={(ev) =>
                        onFilterToggle(ev, 'state', setFiltersExpanded)
                      }
                      dispatch={dispatch}
                      showToolbarItem={incidentPageFilterTypeSelected?.includes('State')}
                    />
                  </ToolbarItem>
                  <ToolbarItem
                    className={
                      incidentPageFilterTypeSelected !== 'Incident ID' ? 'pf-m-hidden' : ''
                    }
                  >
                    <IncidentFilterToolbarItem
                      categoryName="Incident ID"
                      toggleLabel={t('Incident ID filters')}
                      options={incidentIdFilterOptions}
                      incidentsActiveFilters={incidentsActiveFilters}
                      onDeleteIncidentFilterChip={onDeleteIncidentFilterChip}
                      onDeleteGroupIncidentFilterChip={onDeleteGroupIncidentFilterChip}
                      incidentFilterIsExpanded={filtersExpanded.groupId}
                      onIncidentFiltersSelect={onIncidentFiltersSelect}
                      setIncidentIsExpanded={(isExpanded) =>
                        setFiltersExpanded((prev) => ({ ...prev, groupId: isExpanded }))
                      }
                      onIncidentFilterToggle={(ev) =>
                        onFilterToggle(ev, 'groupId', setFiltersExpanded)
                      }
                      dispatch={dispatch}
                      showToolbarItem={incidentPageFilterTypeSelected?.includes('Incident ID')}
                    />
                  </ToolbarItem>
                </ToolbarGroup>
                <ToolbarItem align={{ default: 'alignEnd' }}>
                  <Select
                    id="time-range-select"
                    data-test={DataTestIDs.IncidentsPage.DaysSelect}
                    isOpen={daysFilterIsExpanded}
                    selected={incidentsActiveFilters.days[0]}
                    onSelect={onSelect}
                    onOpenChange={(isOpen) => setDaysFilterIsExpanded(isOpen)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={onToggleClick}
                        isExpanded={daysFilterIsExpanded}
                        data-test={DataTestIDs.IncidentsPage.DaysSelectToggle}
                      >
                        {t(`Last ${incidentsActiveFilters.days[0]}`)}
                      </MenuToggle>
                    )}
                    shouldFocusToggleOnSelect
                  >
                    <SelectList data-test={DataTestIDs.IncidentsPage.DaysSelectList}>
                      <SelectOption
                        value="1 day"
                        data-test={`${DataTestIDs.IncidentsPage.DaysSelectOption}-1-day`}
                      >
                        {t('Last 1 day')}
                      </SelectOption>
                      <SelectOption
                        value="3 days"
                        data-test={`${DataTestIDs.IncidentsPage.DaysSelectOption}-3-days`}
                      >
                        {t('Last 3 days')}
                      </SelectOption>
                      <SelectOption
                        value="7 days"
                        data-test={`${DataTestIDs.IncidentsPage.DaysSelectOption}-7-days`}
                      >
                        {t('Last 7 days')}
                      </SelectOption>
                      <SelectOption
                        value="15 days"
                        data-test={`${DataTestIDs.IncidentsPage.DaysSelectOption}-15-days`}
                      >
                        {t('Last 15 days')}
                      </SelectOption>
                    </SelectList>
                  </Select>
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
                      data-test={DataTestIDs.IncidentsPage.ToggleChartsButton}
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
                      selectedGroupId={selectedGroupId}
                      onIncidentClick={handleIncidentChartClick}
                      currentTime={incidentsLastRefreshTime}
                      lastRefreshTime={incidentsLastRefreshTime}
                    />
                  </StackItem>
                  <StackItem>
                    <AlertsChart theme={theme} />
                  </StackItem>
                </>
              )}
              <StackItem>
                <IncidentsTable />
              </StackItem>
            </Stack>
          </PageSection>
        )
      )}
    </>
  );
};

const IncidentsPageWithFallback = withFallback(IncidentsPage);

export const McpCmoAlertingPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'cmo' }}
    >
      <IncidentsPageWithFallback />
    </MonitoringProvider>
  );
};
