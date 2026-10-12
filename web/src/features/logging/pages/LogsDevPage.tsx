import { Button, Card, CardBody, Flex, Grid, PageSection, Tooltip } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { FC, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import {
  availableDevConsoleAttributes,
  filtersFromQuery,
  initialAvailableAttributes,
  queryFromFilters,
} from '@/features/logging/AttributeFilters';
import { CenteredContainer } from '@/features/logging/components/CenteredContainer';
import { Filters } from '@/features/logging/components/filters/filter-types';
import { LogsHistogram } from '@/features/logging/components/LogsHistogram';
import { LogsMetrics } from '@/features/logging/components/LogsMetrics';
import { LogsTable } from '@/features/logging/components/LogsTable';
import { LogsToolbar } from '@/features/logging/components/LogsToolbar';
import { RefreshIntervalDropdown } from '@/features/logging/components/RefreshIntervalDropdown';
import { TimeRangeDropdown } from '@/features/logging/components/TimeRangeDropdown';
import { TimezoneDropdown } from '@/features/logging/components/TimezoneDropdown';
import { ToggleHistogramButton } from '@/features/logging/components/ToggleHistogramButton';
import { downloadCSV } from '@/features/logging/download-csv';
import { LogsConfigProvider, useLogsConfig } from '@/features/logging/hooks/LogsConfigProvider';
import { useLogs } from '@/features/logging/hooks/useLogs';
import { defaultQueryFromTenant, useURLState } from '@/features/logging/hooks/useURLState';
import { Direction, isMatrixResult } from '@/features/logging/logs-types';
import { TestIds } from '@/features/logging/test-ids';
import { getInitialTenantFromNamespace } from '@/features/logging/value-utils';

/*
This comment creates an entry in the translations catalogue for console extensions

t('plugin__monitoring-plugin~Logs')

*/

interface LogsDevPageProps {
  ns?: string;
}

const LogsDevPage: FC<LogsDevPageProps> = ({ ns: namespaceFromProps }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { ns: namespaceFromParams } = useParams<{ ns: string }>();
  const namespace = namespaceFromParams || namespaceFromProps;
  const [isHistogramVisible, setIsHistogramVisible] = useState(false);
  const tenant = getInitialTenantFromNamespace(namespace);

  const { config, configLoaded } = useLogsConfig();

  const {
    histogramData,
    histogramError,
    isLoadingLogsData,
    isLoadingMoreLogsData,
    isLoadingHistogramData,
    isStreaming,
    logsData,
    logsError,
    volumeData,
    isLoadingVolumeData,
    volumeError,
    showVolumeGraph,
    getLogs,
    getVolume,
    getMoreLogs,
    hasMoreLogsData,
    getHistogram,
    toggleStreaming,
    queriedWithNamespace,
  } = useLogs();

  const {
    query,
    setQueryInURL,
    schema,
    setSchemaInURL,
    areResourcesShown,
    setShowResourcesInURL,
    areStatsShown,
    setShowStatsInURL,
    filters,
    setFilters,
    setTimeRangeInURL,
    timeRange,
    interval,
    direction,
    setDirectionInURL,
    timezone,
    setTimezoneInURL,
    attributes,
  } = useURLState({
    defaultTenant: tenant,
    getAttributes: ({ config: c, schema: s }) =>
      availableDevConsoleAttributes(getInitialTenantFromNamespace(namespace), c, s, namespace),
    attributesDependencies: [namespace],
  });

  const handleToggleStreaming = () => {
    toggleStreaming({ query, schema });
  };

  const handleLoadMoreData = (lastTimestampNs: string) => {
    if (!isLoadingMoreLogsData) {
      getMoreLogs({ lastTimestampNs, query, namespace, direction, schema });
    }
  };

  const handleSortByDate = (directionValue?: Direction) => {
    setDirectionInURL(directionValue);
  };

  const runQuery = ({ queryToUse }: { queryToUse?: string } = {}) => {
    if (!configLoaded) return;

    const queryForRequest = queryToUse ?? query;

    getLogs({ query: queryForRequest, timeRange, direction, tenant, schema });

    if (isHistogramVisible) {
      getHistogram({ query: queryForRequest, timeRange, tenant, schema });
    }
  };

  const runVolume = () => {
    getVolume({ query, tenant, namespace, timeRange, schema });
  };

  const handleFiltersChange = (selectedFilters?: Filters) => {
    setFilters(selectedFilters);
    updateQuery(selectedFilters, tenant);
  };

  const handleQueryChange = (queryFromInput: string) => {
    setQueryInURL(queryFromInput);

    const updatedFilters = filtersFromQuery({
      query: queryFromInput,
      attributes: initialAvailableAttributes(schema),
      schema: schema,
    });

    setFilters(updatedFilters);
  };

  const handleRefreshClick = () => {
    runQuery();
  };

  const updateQuery = (selectedFilters?: Filters, selectedTenant?: string): string => {
    const hasNoSelectedfilters = !selectedFilters || Object.keys(selectedFilters).length === 0;

    if (hasNoSelectedfilters) {
      const updatedQuery = queryFromFilters({
        existingQuery: defaultQueryFromTenant({ tenant: selectedTenant, schema }),
        filters: { namespace: new Set(namespace ? [namespace] : []) },
        attributes: initialAvailableAttributes(schema),
        tenant: selectedTenant,
        schema,
      });

      setQueryInURL(updatedQuery);

      return updatedQuery;
    } else {
      const updatedQuery = queryFromFilters({
        existingQuery: query,
        filters: selectedFilters,
        attributes: initialAvailableAttributes(schema),
        tenant: selectedTenant,
        schema,
      });

      setQueryInURL(updatedQuery);

      return updatedQuery;
    }
  };

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    const queryToUse = updateQuery(filters, tenant);

    runQuery({ queryToUse });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, isHistogramVisible, direction, configLoaded]);

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    const filtersWithNamespace = { ...filters };

    filtersWithNamespace['namespace'] = new Set(namespace ? [namespace] : []);
    const queryToUse = updateQuery(filtersWithNamespace, tenant);

    runQuery({ queryToUse });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, configLoaded]);

  const isQueryEmpty = query === '';
  const isNamespaceFilterEmpty =
    filters?.['namespace'] === undefined || filters['namespace'].size === 0;
  const isRunQueryDisabled = isQueryEmpty || isNamespaceFilterEmpty;

  const resultIsMetric = isMatrixResult(logsData?.data);

  useEffect(() => {
    if (resultIsMetric) {
      setIsHistogramVisible(false);
    }
  }, [resultIsMetric]);

  return (
    <PageSection hasBodyWrapper={false}>
      <Grid hasGutter>
        <Flex justifyContent={{ default: 'justifyContentFlexEnd' }}>
          <Flex>
            <ToggleHistogramButton
              isToggled={isHistogramVisible}
              onToggle={() => setIsHistogramVisible(!isHistogramVisible)}
              data-test={TestIds.ToggleHistogramButton}
              isDisabled={resultIsMetric}
            />
            <TimeRangeDropdown
              value={timeRange}
              onChange={setTimeRangeInURL}
              isDisabled={isRunQueryDisabled}
              timezone={timezone}
            />
            {config.showTimezoneSelector && (
              <TimezoneDropdown
                value={timezone}
                onChange={setTimezoneInURL}
                isDisabled={isQueryEmpty}
              />
            )}
            <RefreshIntervalDropdown onRefresh={runQuery} isDisabled={isRunQueryDisabled} />
            <Tooltip content={<div>Refresh</div>}>
              <Button
                icon={<SyncAltIcon />}
                onClick={handleRefreshClick}
                aria-label="Refresh"
                variant="secondary"
                data-test={TestIds.SyncButton}
                isDisabled={isRunQueryDisabled}
              ></Button>
            </Tooltip>
          </Flex>
        </Flex>

        {isHistogramVisible && !resultIsMetric && (
          <LogsHistogram
            histogramData={histogramData}
            timeRange={timeRange}
            interval={interval}
            isLoading={isLoadingHistogramData}
            error={histogramError}
            onChangeTimeRange={setTimeRangeInURL}
            timezone={timezone}
          />
        )}

        <LogsToolbar
          query={query}
          onQueryChange={handleQueryChange}
          onQueryRun={runQuery}
          onVolumeRun={runVolume}
          invalidQueryErrorMessage={
            isNamespaceFilterEmpty ? t('Please select a namespace') : undefined
          }
          isStreaming={isStreaming}
          onStreamingToggle={handleToggleStreaming}
          enableStreaming={config.isStreamingEnabledInDefaultPage}
          showResources={areResourcesShown}
          onShowResourcesToggle={setShowResourcesInURL}
          showStats={areStatsShown}
          onShowStatsToggle={setShowStatsInURL}
          enableTenantDropdown={false}
          isDisabled={isRunQueryDisabled}
          attributeList={attributes}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onDownloadCSV={() => downloadCSV(logsData)}
          schema={schema}
          onSchemaSelect={setSchemaInURL}
        />

        {isLoadingLogsData ? (
          <CenteredContainer>{t('Loading...')}</CenteredContainer>
        ) : showVolumeGraph ? (
          <Card>
            <CardBody>
              <LogsMetrics
                logsData={volumeData}
                timeRange={timeRange}
                isLoading={isLoadingVolumeData}
                error={volumeError}
                height={350}
                timezone={timezone}
                displayLegendTable
              />
            </CardBody>
          </Card>
        ) : resultIsMetric ? (
          <Card>
            <CardBody>
              <LogsMetrics
                logsData={logsData}
                timeRange={timeRange}
                isLoading={isLoadingLogsData}
                error={logsError}
                height={350}
                timezone={timezone}
                displayLegendTable
              />
            </CardBody>
          </Card>
        ) : (
          <LogsTable
            logsData={logsData}
            onLoadMore={handleLoadMoreData}
            onSortByDate={handleSortByDate}
            isLoading={isLoadingLogsData}
            isLoadingMore={isLoadingMoreLogsData}
            hasMoreLogsData={hasMoreLogsData}
            direction={direction}
            showResources={areResourcesShown}
            showStats={areStatsShown}
            isStreaming={isStreaming}
            error={logsError}
            timezone={timezone}
            hasNamespaceFilter={queriedWithNamespace}
            tenant={tenant}
            schema={schema}
          />
        )}
      </Grid>
    </PageSection>
  );
};

const LogsDevPageWrapper: FC<LogsDevPageProps> = memo((props) => {
  return (
    <LogsConfigProvider>
      <LogsDevPage {...props} />
    </LogsConfigProvider>
  );
});
LogsDevPageWrapper.displayName = 'LogsDevPageWrapper';

export default LogsDevPageWrapper;
