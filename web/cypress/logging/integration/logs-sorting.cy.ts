import { TestIds } from '@/features/logging/utils/test-ids';

const LOGS_PAGE_URL = '/monitoring/logs';
const QUERY_RANGE_STREAMS_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=%7B*';
const QUERY_RANGE_MATRIX_URL_MATCH =
  '/api/proxy/plugin/monitoring-console-plugin/loki/api/logs/v1/application/loki/api/v1/query_range?query=sum*';

const sameTimestampStreamsResponse = () => {
  const msTimestamp = BigInt(Date.now());
  const nanosTimestamp = msTimestamp * 1000000n;
  const nanosString = String(nanosTimestamp);

  return {
    status: 'success',
    data: {
      resultType: 'streams',
      result: [
        {
          stream: {
            filename: '/var/log/out.log',
            job: 'varlogs',
            level: 'info',
            observedTimestamp: String(nanosTimestamp + 200n),
          },
          values: [[nanosString, 'log-line-B']],
        },
        {
          stream: {
            filename: '/var/log/out.log',
            job: 'varlogs',
            level: 'info',
            observedTimestamp: String(nanosTimestamp + 300n),
          },
          values: [[nanosString, 'log-line-C']],
        },
        {
          stream: {
            filename: '/var/log/out.log',
            job: 'varlogs',
            level: 'info',
            observedTimestamp: String(nanosTimestamp + 100n),
          },
          values: [[nanosString, 'log-line-A']],
        },
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 0,
          linesProcessedPerSecond: 0,
          totalBytesProcessed: 0,
          totalLinesProcessed: 0,
          execTime: 0,
          queueTime: 0,
          subqueries: 0,
        },
        querier: {
          store: {
            totalChunksRef: 0,
            totalChunksDownloaded: 0,
            chunksDownloadTime: 0,
            chunk: {
              headChunkBytes: 0,
              headChunkLines: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              compressedBytes: 0,
              totalDuplicates: 0,
            },
          },
        },
        ingester: {
          totalReached: 0,
          totalChunksMatched: 0,
          totalBatches: 0,
          totalLinesSent: 0,
          store: {
            totalChunksRef: 0,
            totalChunksDownloaded: 0,
            chunksDownloadTime: 0,
            chunk: {
              headChunkBytes: 0,
              headChunkLines: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              compressedBytes: 0,
              totalDuplicates: 0,
            },
          },
        },
      },
    },
  };
};

describe('Logs Table Sorting', () => {
  it('sorts same-timestamp logs by observedTimestamp', () => {
    cy.intercept(QUERY_RANGE_STREAMS_URL_MATCH, sameTimestampStreamsResponse()).as(
      'queryRangeStreams',
    );
    cy.intercept(QUERY_RANGE_MATRIX_URL_MATCH, { statusCode: 200, body: {} });

    cy.visit(LOGS_PAGE_URL);

    cy.wait('@queryRangeStreams');

    // Default direction is 'backward' (desc) — largest observedTimestamp first
    // observedTimestamp order: C(+300) > B(+200) > A(+100)
    cy.byTestID(TestIds.LogsTable)
      .should('exist')
      .within(() => {
        cy.get('td[data-label="message"]').should('have.length', 3);
        cy.get('td[data-label="message"]').eq(0).should('contain', 'log-line-C');
        cy.get('td[data-label="message"]').eq(1).should('contain', 'log-line-B');
        cy.get('td[data-label="message"]').eq(2).should('contain', 'log-line-A');
      });
  });
});
