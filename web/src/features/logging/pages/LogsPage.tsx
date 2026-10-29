import {
  Button,
  Card,
  CardBody,
  Flex,
  Grid,
  PageSection,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { FC, memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  availableAttributes,
  filtersFromQuery,
  initialAvailableAttributes,
  queryFromFilters,
} from '@/features/logging/components/AttributeFilters';
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
import { LogsConfigProvider, useLogsConfig } from '@/features/logging/hooks/LogsConfigProvider';
import { useLogs } from '@/features/logging/hooks/useLogs';
import { defaultQueryFromTenant, useURLState } from '@/features/logging/hooks/useURLState';
import { downloadCSV } from '@/features/logging/utils/download-csv';
import { Direction, isMatrixResult } from '@/features/logging/utils/logs-types';
import { TestIds } from '@/features/logging/utils/test-ids';

const LogsPage: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isHistogramVisible, setIsHistogramVisible] = useState(false);

  const { config, configLoaded } = useLogsConfig();

  const {
    histogramData,
    histogramError,
    isLoadingLogsData,
    isLoadingMoreLogsData,
    isLoadingHistogramData,
    isLoadingVolumeData,
    volumeError,
    showVolumeGraph,
    isStreaming,
    logsData,
    volumeData,
    logsError,
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
    tenant,
    setTenantInURL,
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
    getAttributes: availableAttributes,
  });

  const handleToggleStreaming = () => {
    toggleStreaming({ query, schema });
  };

  const handleLoadMoreData = (lastTimestampNs: string) => {
    if (!isLoadingMoreLogsData) {
      getMoreLogs({ lastTimestampNs, query, direction, schema });
    }
  };

  const handleSortByDate = (directionValue?: Direction) => {
    setDirectionInURL(directionValue);
  };

  const runQuery = ({ queryToUse }: { queryToUse?: string } = {}) => {
    if (!configLoaded) return;

    const queryForRequest = queryToUse ?? query;

    getLogs({ query: queryForRequest, tenant, timeRange, direction, schema });

    if (isHistogramVisible) {
      getHistogram({ query: queryForRequest, tenant, timeRange, schema });
    }
  };

  const runVolume = () => {
    getVolume({ query, tenant, timeRange, schema });
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

  const updateQuery = (selectedFilters?: Filters, selectedTenant?: string): string => {
    if ((!selectedFilters || Object.keys(selectedFilters).length === 0) && !selectedTenant) {
      const defaultQuery = defaultQueryFromTenant({ schema });

      setQueryInURL(defaultQuery);

      return defaultQuery;
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

  const handleRefreshClick = () => {
    runQuery();
  };

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    const queryToUse = updateQuery(filters, tenant);

    runQuery({ queryToUse });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, isHistogramVisible, direction, tenant, configLoaded]);

  const isQueryEmpty = query === '';

  const resultIsMetric = isMatrixResult(logsData?.data);

  useEffect(() => {
    if (resultIsMetric) {
      setIsHistogramVisible(false);
    }
  }, [resultIsMetric]);

  return (
    <PageSection hasBodyWrapper={false}>
      <Grid hasGutter>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <Title headingLevel="h1" size="lg">
            {t('Logs')}
          </Title>
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
              isDisabled={isQueryEmpty}
              timezone={timezone}
            />
            {config.showTimezoneSelector && (
              <TimezoneDropdown
                value={timezone}
                onChange={setTimezoneInURL}
                isDisabled={isQueryEmpty}
              />
            )}
            <RefreshIntervalDropdown onRefresh={runQuery} isDisabled={isQueryEmpty} />
            <Tooltip content={<div>Refresh</div>}>
              <Button
                icon={<SyncAltIcon />}
                onClick={handleRefreshClick}
                aria-label="Refresh"
                variant="secondary"
                data-test={TestIds.SyncButton}
                isDisabled={isQueryEmpty}
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
            schema={schema}
            timezone={timezone}
          />
        )}
        <LogsToolbar
          query={query}
          onQueryChange={handleQueryChange}
          onQueryRun={runQuery}
          onVolumeRun={runVolume}
          onTenantSelect={setTenantInURL}
          tenant={tenant}
          isStreaming={isStreaming}
          onStreamingToggle={handleToggleStreaming}
          enableStreaming={config.isStreamingEnabledInDefaultPage}
          showResources={areResourcesShown}
          onShowResourcesToggle={setShowResourcesInURL}
          showStats={areStatsShown}
          onShowStatsToggle={setShowStatsInURL}
          isDisabled={isQueryEmpty}
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
            showResources={areResourcesShown}
            showStats={areStatsShown}
            direction={direction}
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

const WrappedLogsPage: FC = memo(() => {
  return (
    <LogsConfigProvider>
      <LogsPage />
    </LogsConfigProvider>
  );
});
WrappedLogsPage.displayName = 'WrappedLogsPage';

export default WrappedLogsPage;
