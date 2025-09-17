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
  getIncidentIdOptions,
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
  setFilteredIncidentsData,
  setIncidentPageFilterType,
  setIncidents,
  setIncidentsActiveFilters,
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
import IncidentFilterToolbarItem, { severityOptions, stateOptions } from './ToolbarItemFilter';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { ALL_NAMESPACES_KEY } from '../utils';
import { isEmpty } from 'lodash-es';

const IncidentsPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = useMemo(() => parseUrlParams(location.search), [location.search]);
  const { rules } = useAlerts({ overrideNamespace: ALL_NAMESPACES_KEY });
  const { theme } = usePatternFlyTheme();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = useState(true);
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

  const alertsData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData?.alertsData,
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
            groupId: urlParams.groupId ? urlParams.groupId : [],
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
          );
          return response.data.result;
        }),
      )
        .then((results) => {
          const aggregatedData = results.flat();
          dispatch(
            setAlertsData({
              alertsData: processAlerts(aggregatedData, incidentForAlertProcessing, rules),
            }),
          );
          if (!isEmpty(filteredData)) {
            dispatch(setAlertsAreLoading({ alertsAreLoading: false }));
          } else {
            dispatch(setAlertsAreLoading({ alertsAreLoading: true }));
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [incidentForAlertProcessing]);

  useEffect(() => {
    if (rules && alertsData) {
      dispatch(
        setAlertsTableData({
          alertsTableData: groupAlertsForTable(alertsData, rules),
        }),
      );
    }
  }, [alertsData, rules]);

  useEffect(() => {
    (async () => {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            'cluster_health_components_map',
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
    if (selectedGroupId) {
      Promise.all(
        timeRanges.map(async (range) => {
          const response = await fetchDataForIncidentsAndAlerts(
            safeFetch,
            range,
            `cluster_health_components_map{group_id='${selectedGroupId}'}`,
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
  }, [selectedGroupId, timeRanges]);

  const onSelect = (_event, value) => {
    if (value) {
      changeDaysFilter(value, dispatch, incidentsActiveFilters);
    }

    setDaysFilterIsExpanded(false);
  };

  const incidentIdFilterOptions = incidents ? getIncidentIdOptions(incidents) : [];

  //loading states
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
          <PageSection hasBodyWrapper={false} className="incidents-page-main-section">
            <Toolbar
              id="toolbar-with-filter"
              collapseListedFiltersBreakpoint="xl"
              clearAllFilters={() => {
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
                      aria-label="Filter type selection"
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
                        >
                          {incidentPageFilterTypeSelected}
                        </MenuToggle>
                      )}
                      style={{ width: '145px' }}
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
                      <SelectOption
                        value="Incident ID"
                        isSelected={incidentPageFilterTypeSelected?.includes('Incident ID')}
                      >
                        Incident ID
                      </SelectOption>
                    </Select>
                  </ToolbarItem>
                  <ToolbarItem
                    className={incidentPageFilterTypeSelected !== 'Severity' ? 'pf-m-hidden' : ''}
                  >
                    <IncidentFilterToolbarItem
                      categoryName="Severity"
                      toggleLabel="Severity filters"
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
                      toggleLabel="State filters"
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
                      toggleLabel="Incident ID filters"
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
                    <AlertsChart theme={theme} />
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
