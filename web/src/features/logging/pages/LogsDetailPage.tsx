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
import { FC, memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import {
  availablePodAttributes,
  filtersFromQuery,
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
import { useURLState } from '@/features/logging/hooks/useURLState';
import { Direction, isMatrixResult, Schema } from '@/features/logging/logs-types';
import { getStreamLabelsFromSchema, ResourceLabel } from '@/features/logging/ParseResources';
import { TestIds } from '@/features/logging/test-ids';
import { getInitialTenantFromNamespace } from '@/features/logging/value-utils';

/*
This comment creates an entry in the translations catalogue for console extensions

t('plugin__monitoring-plugin~Aggregated Logs')

*/

interface LogsDetailPageProps {
  ns?: string;
  name?: string;
}

const LogsDetailPage: FC<LogsDetailPageProps> = ({
  ns: namespaceFromProps,
  name: podNameFromProps,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { name: podnameFromParams, ns: namespaceFromParams } = useParams<{
    name: string;
    ns: string;
  }>();
  const namespace = namespaceFromParams || namespaceFromProps;
  const podname = podnameFromParams || podNameFromProps;
  const [isHistogramVisible, setIsHistogramVisible] = useState(false);

  const { config, configLoaded } = useLogsConfig();

  const {
    isLoadingLogsData,
    isLoadingMoreLogsData,
    isStreaming,
    logsData,
    logsError,
    getLogs,
    getMoreLogs,
    hasMoreLogsData,
    toggleStreaming,
    getVolume,
    volumeData,
    isLoadingVolumeData,
    volumeError,
    showVolumeGraph,
    getHistogram,
    histogramData,
    isLoadingHistogramData,
    histogramError,
  } = useLogs();

  const {
    initialQuery,
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
    interval,
    timeRange,
    direction,
    setDirectionInURL,
    timezone,
    setTimezoneInURL,
    attributes,
  } = useURLState({
    getDefaultQuery: ({ schema: s }) => {
      const labelMatchers = getStreamLabelsFromSchema(s);
      const podLabel = labelMatchers[ResourceLabel.Pod];

      return `{ ${podLabel} = "${podname}" } ${s == Schema.viaq ? '| json' : ''}`;
    },
    getAttributes: ({ config: c, schema: s }) => {
      if (namespace && podname) {
        return availablePodAttributes(namespace, podname, c, s);
      }
    },
    attributesDependencies: [namespace, podname],
  });

  const initialTenant = getInitialTenantFromNamespace(namespace);
  const tenant = useRef(initialTenant);

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

  const runQuery = () => {
    if (!configLoaded) return;

    getLogs({ query, tenant: tenant.current, namespace, timeRange, direction, schema });

    if (isHistogramVisible) {
      getHistogram({ query, tenant: tenant.current, namespace, timeRange, schema });
    }
  };

  const runVolume = () => {
    getVolume({ query, tenant: tenant.current, namespace, timeRange, schema });
  };

  const handleFiltersChange = (selectedFilters?: Filters) => {
    setFilters(selectedFilters);

    if (!selectedFilters || Object.keys(selectedFilters).length === 0) {
      setQueryInURL(initialQuery);
    } else {
      const updatedQuery = queryFromFilters({
        existingQuery: query,
        filters: selectedFilters,
        attributes,
        schema,
      });
      setQueryInURL(updatedQuery);
    }
  };

  const handleQueryChange = (queryFromInput: string) => {
    setQueryInURL(queryFromInput);

    const updatedFilters = filtersFromQuery({
      query: queryFromInput,
      attributes,
      schema,
    });

    setFilters(updatedFilters);
  };

  useEffect(() => {
    if (!configLoaded) {
      return;
    }

    runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, isHistogramVisible, direction, configLoaded]);

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
                onClick={runQuery}
                aria-label="Refresh"
                variant="secondary"
                data-test={TestIds.SyncButton}
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
          isStreaming={isStreaming}
          onStreamingToggle={handleToggleStreaming}
          showResources={areResourcesShown}
          onShowResourcesToggle={setShowResourcesInURL}
          showStats={areStatsShown}
          onShowStatsToggle={setShowStatsInURL}
          enableStreaming
          enableTenantDropdown={false}
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
            isStreaming={isStreaming}
            onLoadMore={handleLoadMoreData}
            onSortByDate={handleSortByDate}
            isLoading={isLoadingLogsData}
            isLoadingMore={isLoadingMoreLogsData}
            hasMoreLogsData={hasMoreLogsData}
            showResources={areResourcesShown}
            showStats={areStatsShown}
            direction={direction}
            error={logsError}
            timezone={timezone}
            hasNamespaceFilter={true}
            schema={schema}
          />
        )}
      </Grid>
    </PageSection>
  );
};

const LogsDetailPageWrapper: FC<LogsDetailPageProps> = memo((props) => {
  return (
    <LogsConfigProvider>
      <LogsDetailPage {...props} />
    </LogsConfigProvider>
  );
});
LogsDetailPageWrapper.displayName = 'LogsDetailPageWrapper';

export default LogsDetailPageWrapper;
