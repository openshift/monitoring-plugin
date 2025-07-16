/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react';
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
  ToolbarFilter,
  ToolbarItem,
  MenuToggle,
  Badge,
  Title,
  PageSection,
  Stack,
  StackItem,
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
  setIncidents,
  setIncidentsActiveFilters,
} from '../../actions/observe';
import { useLocation } from 'react-router-dom';
import { usePerspective } from '../hooks/usePerspective';
import { changeDaysFilter } from './utils';
import { parsePrometheusDuration } from '../console/console-shared/src/datetime/prometheus';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import IncidentsChart from './IncidentsChart/IncidentsChart';
import AlertsChart from './AlertsChart/AlertsChart';
import { usePatternFlyTheme } from '../hooks/usePatternflyTheme';
import { DaysFilters, IncidentFilters } from './models';

const IncidentsPage = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const dispatch = useDispatch();
  const location = useLocation();
  const urlParams = React.useMemo(() => parseUrlParams(location.search), [location.search]);
  const { perspective } = usePerspective();
  const { theme } = usePatternFlyTheme();
  // loading states
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  // days span is where we store the value for creating time ranges for
  // fetch incidents/alerts based on the length of time ranges
  // when days filter changes we set a new days span -> calculate new time range and fetch new data
  const [daysSpan, setDaysSpan] = React.useState<number>(7);
  const [timeRanges, setTimeRanges] = React.useState([]);
  // data that is used for processing to serve it to the alerts table and chart
  const [incidentForAlertProcessing, setIncidentForAlertProcessing] = React.useState([]);
  const [hideCharts, setHideCharts] = React.useState(false);

  const [incidentFilterIsExpanded, setIncidentIsExpanded] = React.useState(false);
  const [daysFilterIsExpanded, setDaysFilterIsExpanded] = React.useState(false);

  const onIncidentFilterToggle = (ev) => {
    ev.stopPropagation();
    setIncidentIsExpanded(!incidentFilterIsExpanded);
  };
  const onToggleClick = (ev) => {
    ev.stopPropagation();
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
    state.plugins.mcp.getIn(['incidentsData', 'groupId']),
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
            days: urlParams.days ? urlParams.days : ['7 days'],
            incidentFilters: urlParams.incidentFilters ? urlParams.incidentFilters : [],
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

  React.useEffect(() => {
    updateBrowserUrl(incidentsActiveFilters, incidentGroupId);
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

  React.useEffect(() => {
    dispatch(
      setAlertsTableData({
        alertsTableData: groupAlertsForTable(alertsData),
      }),
    );
  }, [alertsData]);

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

  const onSelect = (_event: React.MouseEvent, value?: string) => {
    if (value) {
      changeDaysFilter(value as DaysFilters, dispatch, incidentsActiveFilters);
    }

    setDaysFilterIsExpanded(false);
  };

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        <Title headingLevel="h1">{t('Incidents')}</Title>
      </PageSection>
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
              onDeleteIncidentFilterChip('', undefined, incidentsActiveFilters, dispatch)
            }
          >
            <ToolbarContent>
              <ToolbarItem>
                <ToolbarFilter
                  labels={incidentsActiveFilters.incidentFilters}
                  deleteLabel={(category, chip) =>
                    onDeleteIncidentFilterChip(
                      category as string,
                      chip as IncidentFilters,
                      incidentsActiveFilters,
                      dispatch,
                    )
                  }
                  deleteLabelGroup={() =>
                    onDeleteGroupIncidentFilterChip(incidentsActiveFilters, dispatch)
                  }
                  categoryName="Filters"
                >
                  <Select
                    id="severity-select"
                    role="menu"
                    aria-label="Filters"
                    isOpen={incidentFilterIsExpanded}
                    selected={incidentsActiveFilters.incidentFilters}
                    onSelect={(event, selection) =>
                      onIncidentFiltersSelect(
                        event,
                        selection as IncidentFilters,
                        dispatch,
                        incidentsActiveFilters,
                      )
                    }
                    onOpenChange={(isOpen) => setIncidentIsExpanded(isOpen)}
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        onClick={onIncidentFilterToggle}
                        isExpanded={incidentFilterIsExpanded}
                        icon={<FilterIcon />}
                        badge={
                          Object.entries(incidentsActiveFilters.incidentFilters).length > 0 ? (
                            <Badge isRead>
                              {Object.entries(incidentsActiveFilters.incidentFilters).length}
                            </Badge>
                          ) : undefined
                        }
                      >
                        Filters
                      </MenuToggle>
                    )}
                    shouldFocusToggleOnSelect
                  >
                    <SelectList>
                      <SelectOption
                        value="Critical"
                        isSelected={incidentsActiveFilters?.incidentFilters.includes('Critical')}
                        description="The incident is critical."
                        hasCheckbox
                      >
                        Critical
                      </SelectOption>
                      <SelectOption
                        value="Warning"
                        isSelected={incidentsActiveFilters?.incidentFilters.includes('Warning')}
                        description="The incident might lead to critical."
                        hasCheckbox
                      >
                        Warning
                      </SelectOption>
                      <SelectOption
                        value="Informative"
                        isSelected={incidentsActiveFilters.incidentFilters.includes('Informative')}
                        description="The incident is not critical."
                        hasCheckbox
                      >
                        Informative
                      </SelectOption>
                      <SelectOption
                        value="Firing"
                        isSelected={incidentsActiveFilters.incidentFilters.includes('Firing')}
                        description="The incident is currently firing."
                        hasCheckbox
                      >
                        Firing
                      </SelectOption>
                      <SelectOption
                        value="Resolved"
                        isSelected={incidentsActiveFilters.incidentFilters.includes('Resolved')}
                        description="The incident is not currently firing."
                        hasCheckbox
                      >
                        Resolved
                      </SelectOption>
                    </SelectList>
                  </Select>
                </ToolbarFilter>
              </ToolbarItem>
              <ToolbarItem>
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
                      {incidentsActiveFilters.days[0]}
                    </MenuToggle>
                  )}
                  shouldFocusToggleOnSelect
                >
                  <SelectList>
                    <SelectOption value="1 day">{t('1 day')}</SelectOption>
                    <SelectOption value="3 days">{t('3 days')}</SelectOption>
                    <SelectOption value="7 days">{t('7 days')}</SelectOption>
                    <SelectOption value="15 days">{t('15 days')}</SelectOption>
                  </SelectList>
                </Select>
              </ToolbarItem>
              <ToolbarItem align={{ default: 'alignEnd' }}>
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
          <Stack hasGutter>
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
    </>
  );
};

const incidentsPageWithFallback = withFallback(IncidentsPage);

export default incidentsPageWithFallback;
