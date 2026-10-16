import { Card, CardBody, CardTitle, Split, SplitItem, Tooltip } from '@patternfly/react-core';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

import '@/features/logging/components/stats-table.css';
import { QueryRangeResponse } from '@/features/logging/logs-types';
import { TestIds } from '@/features/logging/test-ids';

interface StatsTableProps {
  logsData?: QueryRangeResponse;
}

const convertBytes = (bytes: number | undefined) => {
  if (bytes === undefined) {
    return undefined;
  }

  if (bytes <= 1000000) {
    return bytes + ' B';
  }

  // convert Bytes to MB
  return Math.round((bytes / 1000000) * 100) / 100 + ' MB';
};

const convertTime = (time: number | undefined) => {
  if (time === undefined) {
    return undefined;
  }

  if (time >= 1) {
    return Math.round(time * 100) / 100 + ' s';
  }
  // convert float seconds to ms
  return Math.round(time * 1000 * 100) / 100 + ' ms';
};

const convertNano = (time: number | undefined) => {
  if (time === undefined) {
    return undefined;
  }
  // converts ns to ns
  time = Math.round((time / 1000000) * 100) / 100;

  // if the time is > 1s
  if (time >= 1000) {
    return Math.round((time / 1000) * 100) / 100 + ' s';
  }

  return Math.round(time * 100) / 100 + ' ms';
};

// Helper functions for timing calculations
const getChunkRefsFetchTime = (logsData?: QueryRangeResponse): number => {
  const ingesterFetchTime = logsData?.data.stats.ingester?.store?.chunkRefsFetchTime || 0;
  const querierFetchTime = logsData?.data.stats.querier?.store?.chunkRefsFetchTime || 0;
  return (ingesterFetchTime + querierFetchTime) / 1000000000; // Convert nanosec to sec
};

const getChunksDownloadTime = (logsData?: QueryRangeResponse): number => {
  const ingesterDownloadTime = logsData?.data.stats.ingester?.store?.chunksDownloadTime || 0;
  const querierDownloadTime = logsData?.data.stats.querier?.store?.chunksDownloadTime || 0;
  return (ingesterDownloadTime + querierDownloadTime) / 1000000000; // Convert nanosec to sec
};

const getQueryDuration = (logsData?: QueryRangeResponse): number => {
  return logsData?.data.stats.summary?.execTime || 0;
};

const getQueueTime = (logsData?: QueryRangeResponse): number => {
  return logsData?.data.stats.summary?.queueTime || 0;
};

const getTotalQueryTime = (logsData?: QueryRangeResponse): number => {
  return getQueryDuration(logsData) + getQueueTime(logsData);
};

const getExecutionTime = (logsData?: QueryRangeResponse): number => {
  const queryDuration = getQueryDuration(logsData);
  const chunkRefsFetchTime = getChunkRefsFetchTime(logsData);
  const chunksDownloadTime = getChunksDownloadTime(logsData);
  return queryDuration - chunkRefsFetchTime - chunksDownloadTime;
};

const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return Math.round(percentage * 100) / 100 + '%';
};

interface TableComponentProps {
  logsData?: QueryRangeResponse;
  title: string;
}

const SummaryStatsTable: FC<TableComponentProps> = ({ logsData, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <div className="lv-plugin__stats-section-title">{title}</div>
      <Table variant="compact" aria-label={title}>
        <Thead>
          <Tr>
            <Th>{t('Metric')}</Th>
            <Th>{t('Value')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>
              <Tooltip content={t('Total query time including queue and execution')}>
                <span>{t('Total query time')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{convertTime(getTotalQueryTime(logsData)) ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Time spent queued waiting for query to be processed')}>
                <span>{t('Time spent in Queued')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertTime(getQueueTime(logsData)) ?? 'NA'} (
                {formatPercentage(getQueueTime(logsData), getTotalQueryTime(logsData))})
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Time spent in actual execution.')}>
                <span>{t('Time spent in Execution')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertTime(getExecutionTime(logsData)) ?? 'NA'} (
                {formatPercentage(getExecutionTime(logsData), getTotalQueryTime(logsData))})
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip
                content={t(
                  'Time spent fetching chunk references from index for both ingester and querier',
                )}
              >
                <span>{t('Time spent in Index')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertTime(getChunkRefsFetchTime(logsData)) ?? 'NA'} (
                {formatPercentage(getChunkRefsFetchTime(logsData), getTotalQueryTime(logsData))})
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip
                content={t(
                  'Time spent downloading chunks from store for both ingester and querier',
                )}
              >
                <span>{t('Time spent in Store')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertTime(getChunksDownloadTime(logsData)) ?? 'NA'} (
                {formatPercentage(getChunksDownloadTime(logsData), getTotalQueryTime(logsData))})
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of bytes processed per second')}>
                <span>{t('Bytes Processed Per Second')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.summary?.bytesProcessedPerSecond) ?? 'NA'}/s
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines processed per second')}>
                <span>{t('Lines Processed Per Second')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.linesProcessedPerSecond ?? 'NA'}/s</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total amount of bytes processed overall for this request')}>
                <span>{t('Total Bytes Processed')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.summary?.totalBytesProcessed) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total amount of lines processed overall for this request')}>
                <span>{t('Total Lines Processed')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.totalLinesProcessed ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total amount of sub queries')}>
                <span>{t('Sub Queries')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.subqueries ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total amount of entries')}>
                <span>{t('Total Entries Returned')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.totalEntriesReturned ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total amount of splits')}>
                <span>{t('Splits')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.splits ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of shards')}>
                <span>{t('Shards')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.summary?.shards ?? 'NA'}</strong>
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );
};

const IngesterStatsTable: FC<TableComponentProps> = ({ logsData, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <div className="lv-plugin__stats-section-title">{title}</div>
      <Table variant="compact" aria-label={title}>
        <Thead>
          <Tr>
            <Th>{t('Metric')}</Th>
            <Th>{t('Value')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>
              <Tooltip content={t('Amount of ingesters reached')}>
                <span>{t('Total Reached')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.totalReached ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total chunks matched by ingesters')}>
                <span>{t('Total Chunks Matched')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.totalChunksMatched ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total batches sent by ingesters')}>
                <span>{t('Total Batches')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.totalBatches ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines sent by ingesters')}>
                <span>{t('Total Lines Sent')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.totalLinesSent ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip
                content={t('Total chunks found in the index for the current query by ingesters')}
              >
                <span>{t('Total Chunks Referenced')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.store?.totalChunksRef ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of chunks downloaded')}>
                <span>{t('Total Chunks Downloaded')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.store?.totalChunksDownloaded ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total time spent fetching chunk references in seconds')}>
                <span>{t('Chunk Refs Fetch Time')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertNano(logsData?.data.stats.ingester?.store?.chunkRefsFetchTime) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total time spent downloading chunks in seconds')}>
                <span>{t('Chunks Download Time')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertNano(logsData?.data.stats.ingester?.store?.chunksDownloadTime) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total bytes read from ingesters head chunks')}>
                <span>{t('Head Chunk Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.ingester?.store?.chunk?.headChunkBytes) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines read from ingesters head chunks')}>
                <span>{t('Head Chunk Lines')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.ingester?.store?.chunk?.headChunkLines ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total bytes decompressed and processed by ingesters')}>
                <span>{t('Decompressed Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.ingester?.store?.chunk?.decompressedBytes) ??
                  'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines decompressed and processed by ingesters')}>
                <span>{t('Decompressed Lines')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {logsData?.data.stats.ingester?.store?.chunk?.decompressedLines ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip
                content={t('Total bytes of compressed chunks (blocks) processed by ingesters')}
              >
                <span>{t('Compressed Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.ingester?.store?.chunk?.compressedBytes) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of duplicates found by ingesters')}>
                <span>{t('Total Duplicates')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {logsData?.data.stats.ingester?.store?.chunk?.totalDuplicates ?? 'NA'}
              </strong>
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );
};

const QuerierStatsTable: FC<TableComponentProps> = ({ logsData, title }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div>
      <div className="lv-plugin__stats-section-title">{title}</div>
      <Table variant="compact" aria-label={title}>
        <Thead>
          <Tr>
            <Th>{t('Metric')}</Th>
            <Th>{t('Value')}</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>
              <Tooltip content={t('Total chunks found in the index for the current query')}>
                <span>{t('Total Chunks Referenced')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.querier?.store?.totalChunksRef ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of chunks downloaded')}>
                <span>{t('Total Chunks Downloaded')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.querier?.store?.totalChunksDownloaded ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total time spent fetching chunk references')}>
                <span>{t('Chunk Refs Fetch Time')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertNano(logsData?.data.stats.querier?.store?.chunkRefsFetchTime) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total time spent downloading chunks in seconds')}>
                <span>{t('Chunks Download Time')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertNano(logsData?.data.stats.querier?.store?.chunksDownloadTime) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total bytes read from store head chunks')}>
                <span>{t('Head Chunk Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.querier?.store?.chunk?.headChunkBytes) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines read from store head chunks')}>
                <span>{t('Head Chunk Lines')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.querier?.store?.chunk?.headChunkLines ?? 'NA'}</strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total bytes decompressed and processed by store')}>
                <span>{t('Decompressed Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.querier?.store?.chunk?.decompressedBytes) ??
                  'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total lines decompressed and processed by the store')}>
                <span>{t('Decompressed Lines')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {logsData?.data.stats.querier?.store?.chunk?.decompressedLines ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip
                content={t('Total bytes of compressed chunks (blocks) processed by the store')}
              >
                <span>{t('Compressed Bytes')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>
                {convertBytes(logsData?.data.stats.querier?.store?.chunk?.compressedBytes) ?? 'NA'}
              </strong>
            </Td>
          </Tr>
          <Tr>
            <Td>
              <Tooltip content={t('Total of duplicates removed from replication')}>
                <span>{t('Total Duplicates')}</span>
              </Tooltip>
            </Td>
            <Td>
              <strong>{logsData?.data.stats.querier?.store?.chunk?.totalDuplicates ?? 'NA'}</strong>
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );
};

export const StatsTable: FC<StatsTableProps> = ({ logsData }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Card className="lv-plugin__stats__card" data-test={TestIds.LogsStats}>
      <CardTitle>{t('Statistics')}</CardTitle>
      <CardBody>
        <Split hasGutter>
          <SplitItem isFilled>
            <SummaryStatsTable logsData={logsData} title={t('Summary')} />
          </SplitItem>
          <SplitItem isFilled>
            <IngesterStatsTable logsData={logsData} title={t('Ingester')} />
          </SplitItem>
          <SplitItem isFilled>
            <QuerierStatsTable logsData={logsData} title={t('Querier')} />
          </SplitItem>
        </Split>
      </CardBody>
    </Card>
  );
};
