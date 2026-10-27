const generateMatrixValues = ({ nValues, startTime }: { nValues: number; startTime: number }) =>
  Array.from({ length: nValues }, (_, i) => [
    startTime + i * 60,
    String(Math.floor(Math.random() * 9999) + 100),
  ]);

const generateStreamValues = ({
  nValues,
  startTime,
  message = 'loki_1      | level=info ts=2022-07-01T08:21:47.5874835Z caller=table.go:443 msg="cleaning up unwanted dbs from table index_19172"',
  value,
}: {
  message?: string;
  nValues: number;
  startTime: number;
  value?: string;
}) => Array.from({ length: nValues }, (_, i) => [startTime * 1e6 + i, value || message]);

const generateStream = ({
  level,
  nValues,
  startTime,
  message,
  value,
  labels,
}: {
  level: string;
  startTime: number;
  nValues: number;
  message?: string;
  value?: string;
  labels?: Record<string, string>;
}) => ({
  stream: {
    filename: '/var/log/out.log',
    job: 'varlogs',
    level,
    message,
    ...labels,
  },
  values: generateStreamValues({ nValues, startTime, message, value }),
});

export const queryRangeStreamsValidResponse = ({
  message,
  labels,
}: {
  message?: string;
  labels?: Record<string, string>;
}) => {
  const startTime = Date.now();

  return {
    status: 'success',
    data: {
      resultType: 'streams',
      result: [
        generateStream({ level: 'info', nValues: 50, startTime, message, labels }),
        generateStream({ level: 'error', nValues: 50, startTime, message, labels }),
        generateStream({ level: 'warning', nValues: 50, startTime, message, labels }),
        generateStream({ level: 'critical', nValues: 50, startTime, message, labels }),
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 269479887,
          linesProcessedPerSecond: 859141,
          totalBytesProcessed: 28840573,
          totalLinesProcessed: 91948,
          execTime: 0.1070231,
          queueTime: 0.0000893,
          subqueries: 1,
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
          totalReached: 1,
          totalChunksMatched: 8,
          totalBatches: 2,
          totalLinesSent: 200,
          store: {
            totalChunksRef: 8,
            totalChunksDownloaded: 8,
            chunksDownloadTime: 1248200,
            chunk: {
              headChunkBytes: 990544,
              headChunkLines: 5782,
              decompressedBytes: 27850029,
              decompressedLines: 86166,
              compressedBytes: 2935987,
              totalDuplicates: 0,
            },
          },
        },
      },
    },
  };
};

export const queryRangeMatrixValidResponse = () => {
  const startTime = Math.floor((Date.now() - 1000 * 60 * 60) / 1000);
  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [
        {
          metric: {
            filename: '/var/log/generated.log',
            job: 'varlogs-duplicate',
            kubernetes_container_name: 'test-container',
            kubernetes_namespace_name: 'log-test',
            kubernetes_pod_name: 'alertmanager-main-0',
            level: '',
            log_type: 'application',
          },
          values: generateMatrixValues({ nValues: 60, startTime }),
        },
        {
          metric: {
            filename: '/var/log/generated.log',
            job: 'varlogs-duplicate',
            kubernetes_container_name: 'test-container',
            kubernetes_namespace_name: 'log-test',
            kubernetes_pod_name: 'alertmanager-main-0',
            level: 'error',
            log_type: 'application',
          },
          values: generateMatrixValues({ nValues: 60, startTime }),
        },
        {
          metric: {
            filename: '/var/log/generated.log',
            job: 'varlogs-duplicate',
            kubernetes_container_name: 'test-container',
            kubernetes_namespace_name: 'log-test',
            kubernetes_pod_name: 'alertmanager-main-0',
            level: 'info',
            log_type: 'application',
          },
          values: generateMatrixValues({ nValues: 60, startTime }),
        },
        {
          metric: {
            filename: '/var/log/generated.log',
            job: 'varlogs-duplicate',
            kubernetes_container_name: 'test-container',
            kubernetes_namespace_name: 'log-test',
            kubernetes_pod_name: 'alertmanager-main-0',
            level: 'warn',
            log_type: 'application',
          },
          values: generateMatrixValues({ nValues: 60, startTime }),
        },
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 547879221,
          linesProcessedPerSecond: 1724574,
          totalBytesProcessed: 150371972,
          totalLinesProcessed: 473330,
          execTime: 0.2744619,
          queueTime: 1.915225593,
          subqueries: 3,
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
          totalReached: 48,
          totalChunksMatched: 26,
          totalBatches: 726,
          totalLinesSent: 366634,
          store: {
            totalChunksRef: 8,
            totalChunksDownloaded: 8,
            chunksDownloadTime: 9204000,
            chunk: {
              headChunkBytes: 707614,
              headChunkLines: 3942,
              decompressedBytes: 149664358,
              decompressedLines: 469388,
              compressedBytes: 12792674,
              totalDuplicates: 93688,
            },
          },
        },
      },
    },
  };
};

export const queryRangeMatrixInvalidResponse = () => {
  return {};
};

export const queryRangeMatrixEmptyResponse = () => {
  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [],
      stats: {
        summary: {
          bytesProcessedPerSecond: 0,
          linesProcessedPerSecond: 0,
          totalBytesProcessed: 0,
          totalLinesProcessed: 0,
          execTime: 0.029010703,
          queueTime: 0,
          subqueries: 4,
          totalEntriesReturned: 0,
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
          totalReached: 16,
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
        cache: {
          chunk: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
          },
          index: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
          },
          result: {
            entriesFound: 3,
            entriesRequested: 3,
            entriesStored: 1,
            bytesReceived: 638,
            bytesSent: 0,
            requests: 4,
          },
        },
      },
    },
  };
};

export const queryRangeStreamsInvalidResponse = () => {
  return {};
};

export const queryRangeStreamsErrorResponse = () => {
  return 'max entries limit';
};

export const queryRangeStreamsWithLineFormatting = () => {
  const startTime = Date.now();

  const message = `formatted string`;
  const value = `formatted string`;

  return {
    status: 'success',
    data: {
      resultType: 'streams',
      result: [
        generateStream({
          level: 'info',
          nValues: 50,
          startTime,
          message,
          value,
        }),
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 269479887,
          linesProcessedPerSecond: 859141,
          totalBytesProcessed: 28840573,
          totalLinesProcessed: 91948,
          execTime: 0.1070231,
          queueTime: 0.0000893,
          subqueries: 1,
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
          totalReached: 1,
          totalChunksMatched: 8,
          totalBatches: 2,
          totalLinesSent: 200,
          store: {
            totalChunksRef: 8,
            totalChunksDownloaded: 8,
            chunksDownloadTime: 1248200,
            chunk: {
              headChunkBytes: 990544,
              headChunkLines: 5782,
              decompressedBytes: 27850029,
              decompressedLines: 86166,
              compressedBytes: 2935987,
              totalDuplicates: 0,
            },
          },
        },
      },
    },
  };
};

export const queryRangeStreamsWithMessage = () => {
  const startTime = Date.now();

  const message = `a message`;
  const value = `{ json:"object" }`;

  return {
    status: 'success',
    data: {
      resultType: 'streams',
      result: [
        generateStream({
          level: 'info',
          nValues: 50,
          startTime,
          message,
          value,
        }),
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 269479887,
          linesProcessedPerSecond: 859141,
          totalBytesProcessed: 28840573,
          totalLinesProcessed: 91948,
          execTime: 0.1070231,
          queueTime: 0.0000893,
          subqueries: 1,
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
          totalReached: 1,
          totalChunksMatched: 8,
          totalBatches: 2,
          totalLinesSent: 200,
          store: {
            totalChunksRef: 8,
            totalChunksDownloaded: 8,
            chunksDownloadTime: 1248200,
            chunk: {
              headChunkBytes: 990544,
              headChunkLines: 5782,
              decompressedBytes: 27850029,
              decompressedLines: 86166,
              compressedBytes: 2935987,
              totalDuplicates: 0,
            },
          },
        },
      },
    },
  };
};

export const volumeRangeMatrixValidResponse = () => {
  const startTime = Math.floor((Date.now() - 1000 * 60 * 60) / 1000);
  return {
    status: 'success',
    data: {
      resultType: 'matrix',
      result: [
        {
          metric: {
            level: 'info',
          },
          values: generateMatrixValues({ nValues: 20, startTime }),
        },
      ],
      stats: {
        summary: {
          bytesProcessedPerSecond: 0,
          linesProcessedPerSecond: 0,
          totalBytesProcessed: 0,
          totalLinesProcessed: 0,
          execTime: 0.038628073,
          queueTime: 0,
          subqueries: 0,
          totalEntriesReturned: 1,
          splits: 251,
          shards: 0,
          totalPostFilterLines: 0,
          totalStructuredMetadataBytesProcessed: 0,
        },
        querier: {
          store: {
            totalChunksRef: 0,
            totalChunksDownloaded: 0,
            chunksDownloadTime: 0,
            queryReferencedStructuredMetadata: false,
            chunk: {
              headChunkBytes: 0,
              headChunkLines: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              compressedBytes: 0,
              totalDuplicates: 0,
              postFilterLines: 0,
              headChunkStructuredMetadataBytes: 0,
              decompressedStructuredMetadataBytes: 0,
            },
            chunkRefsFetchTime: 0,
            congestionControlLatency: 0,
            pipelineWrapperFilteredLines: 0,
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
            queryReferencedStructuredMetadata: false,
            chunk: {
              headChunkBytes: 0,
              headChunkLines: 0,
              decompressedBytes: 0,
              decompressedLines: 0,
              compressedBytes: 0,
              totalDuplicates: 0,
              postFilterLines: 0,
              headChunkStructuredMetadataBytes: 0,
              decompressedStructuredMetadataBytes: 0,
            },
            chunkRefsFetchTime: 0,
            congestionControlLatency: 0,
            pipelineWrapperFilteredLines: 0,
          },
        },
        cache: {
          chunk: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          index: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          result: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          statsResult: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          volumeResult: {
            entriesFound: 13,
            entriesRequested: 13,
            entriesStored: 5,
            bytesReceived: 17069,
            bytesSent: 0,
            requests: 18,
            downloadTime: 216375,
            queryLengthServed: 2903000000000,
          },
          seriesResult: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          labelResult: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
          instantMetricResult: {
            entriesFound: 0,
            entriesRequested: 0,
            entriesStored: 0,
            bytesReceived: 0,
            bytesSent: 0,
            requests: 0,
            downloadTime: 0,
            queryLengthServed: 0,
          },
        },
        index: {
          totalChunks: 0,
          postFilterChunks: 0,
          shardsDuration: 0,
        },
      },
    },
  };
};
