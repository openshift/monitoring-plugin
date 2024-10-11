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
  Spinner,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { useBoolean } from '../hooks/useBoolean';
import some from 'lodash-es/some';
import { dropdownItems } from './consts';
import { IncidentsTable } from './IncidentsTable';
import { getIncidentsTimeRanges, processIncidents } from './processIncidents';
import { filterIncident } from './utils';
import { groupAlertsForTable, processAlerts } from './processAlerts';

const IncidentsPage = ({ customDataSource, namespace }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  const [alertsAreLoading, setAlertsAreLoading] = React.useState(true);
  const [span, setSpan] = React.useState(parsePrometheusDuration('7d'));
  const [alertsData, setAlertsData] = React.useState([]);
  const [incidentsData, setIncidentsData] = React.useState([]);
  const [tableData, setTableData] = React.useState([]);
  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [chooseIncident, setChooseIncident] = React.useState('');
  const [filteredIncidentsData, setFilteredIncidentsData] = React.useState([]);

  const now = Date.now();
  const timeRanges = getIncidentsTimeRanges(span, now);
  const safeFetch = useSafeFetch();
  const title = t('Incidents');
  const matcher = (incident, prop) => some([incident], prop);

  const incidentTypeFilter = (t) => ({
    filter: filterIncident,
    filterGroupName: t('Incident type'),
    isMatch: (incident, prop) => matcher(incident, prop),
    items: [
      { id: 'longStanding', title: t('Long standing') },
      { id: 'informative', title: t('Informative') },
      { id: 'inactive', title: t('Inactive') },
    ],
    type: 'incident-type',
  });
  const [staticData, filteredData, onFilterChange] = useListPageFilter(incidentsData, [
    incidentTypeFilter(t),
  ]);

  const changeDaysFilter = (days) => {
    setSpan(parsePrometheusDuration(days));
  };

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
                query: createAlertsQuery(filteredIncidentsData),
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
  }, [filteredIncidentsData]);
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
  }, [span]);

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
        setFilteredIncidentsData(processIncidents(aggregatedData));
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
          <Flex direction={{ default: 'row' }}>
            <ListPageFilter
              data={staticData}
              hideNameLabelFilters={true}
              loaded={true}
              onFilterChange={onFilterChange}
              rowFilters={[incidentTypeFilter(t)]}
            />
            <Dropdown
              dropdownItems={dropdownItems(changeDaysFilter, t)}
              isOpen={isOpen}
              onSelect={setClosed}
              position={DropdownPosition.left}
              toggle={
                <DropdownToggle id="incidents-page-days-filter-toggle" onToggle={setIsOpen}>
                  Date range
                </DropdownToggle>
              }
            />
          </Flex>
          <IncidentsHeader
            alertsData={alertsData}
            incidentsData={filteredData}
            chartDays={timeRanges.length}
            onIncidentSelect={setChooseIncident}
            tableIsLoading={setAlertsAreLoading}
          />
          <div className="row">
            <div className="col-xs-12">
              <IncidentsTable loaded={!alertsAreLoading} data={tableData} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IncidentsPage;
