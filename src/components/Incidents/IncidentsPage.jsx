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
import {
  filterIncident,
  getIncidentsTimeRanges,
  processAlertTimestamps,
  processIncidentTimestamps,
} from './utils';
import { useTranslation } from 'react-i18next';
import {
  Bullseye,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Flex,
  Spinner,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { useBoolean } from '../hooks/useBoolean';

const IncidentsPage = ({ customDataSource, namespace }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const [incidentsAreLoading, setIncidentsAreLoading] = React.useState(true);
  const [alertsAreLoading, setAlertsAreLoading] = React.useState(true);
  const [span, setSpan] = React.useState(parsePrometheusDuration('7d'));
  const [alertsData, setAlertsData] = React.useState([]);
  const [incidentsData, setIncidentsData] = React.useState([]);
  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const now = Date.now();
  const timeRanges = getIncidentsTimeRanges(span, now);
  const safeFetch = useSafeFetch();
  const title = t('Incidents');

  const incidentTypeFilter = (t) => ({
    filter: (filter, incident) => filterIncident(incident, filter),
    filterGroupName: t('Incident type'),
    isMatch: () => console.log('here should be filter state'),
    items: [
      { id: 'long-standing', title: t('Long standing') },
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
  const dropdownItems = [
    <DropdownItem key="1-day-filter" component="button" onClick={() => changeDaysFilter('1d')}>
      {t('1 day')}
    </DropdownItem>,
    <DropdownItem key="3-day-filter" component="button" onClick={() => changeDaysFilter('3d')}>
      {t('3 days')}
    </DropdownItem>,
    <DropdownItem key="7-day-filter" component="button" onClick={() => changeDaysFilter('7d')}>
      {t('7 days')}
    </DropdownItem>,
    <DropdownItem key="15-day-filter" component="button" onClick={() => changeDaysFilter('15d')}>
      {t('15 days')}
    </DropdownItem>,
  ];

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
                query: 'ALERTS',
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
          setAlertsData(processAlertTimestamps(aggregatedData));
          setAlertsAreLoading(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [span]);

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
                query:
                  'max by(group_id,component,src_alertname,src_severity,type)(cluster:health:components:map{})',
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
          setIncidentsData(processIncidentTimestamps(aggregatedData));
          setIncidentsAreLoading(false);
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.log(err);
        });
    })();
  }, [span]);

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
              dropdownItems={dropdownItems}
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
          />
        </div>
      )}
    </>
  );
};

export default IncidentsPage;
