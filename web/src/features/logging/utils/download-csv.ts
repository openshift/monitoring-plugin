import { isStreamsResult, QueryRangeResponse } from '@/features/logging/utils/logs-types';

export const escapeCSVValue = (value: string | number) => {
  if (typeof value === 'number') {
    return value;
  }

  if (value === undefined) {
    return '';
  }

  let stringValue = String(value).trim();

  if (/^[=+\-@\t\r]/.test(stringValue)) {
    stringValue = "'" + stringValue;
  }

  if (stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
  }

  return stringValue.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
};

export const csvFromQueryResponse = (response?: QueryRangeResponse): string => {
  if (!response) {
    return '';
  }

  let csvData = '';

  if (isStreamsResult(response.data)) {
    const columns = response.data.result.flatMap((res) => Object.keys(res.stream));

    const uniqueColumns = Array.from(['time', ...new Set(columns), 'raw']);

    csvData += uniqueColumns.map((col) => escapeCSVValue(col)).join(',') + '\n';

    for (const res of response.data.result) {
      for (const value of res.values) {
        for (const col of uniqueColumns) {
          if (col === 'time') {
            csvData += escapeCSVValue(value?.[0]) + ',';
            continue;
          }

          if (col === 'raw') {
            csvData += escapeCSVValue(value?.[1]) + ',';
            continue;
          }

          csvData += escapeCSVValue(res.stream[col]) + ',';
        }
        csvData += '\n';
      }
    }
  } else {
    const columns = response.data.result.flatMap((res) => Object.keys(res.metric));

    const uniqueColumns = Array.from(['time', 'y', ...new Set(columns)]);

    csvData += uniqueColumns.map((col) => escapeCSVValue(col)).join(',') + '\n';

    for (const res of response.data.result) {
      for (const value of res.values) {
        for (const col of uniqueColumns) {
          if (col === 'time') {
            csvData += escapeCSVValue(value[0]) + ',';
            continue;
          }

          if (col === 'y') {
            csvData += escapeCSVValue(value[1]) + ',';
            continue;
          }

          csvData += escapeCSVValue(res.metric[col]) + ',';
        }
        csvData += '\n';
      }
    }
  }

  return csvData;
};

export const downloadCSV = (queryResponse?: QueryRangeResponse) => {
  const csvData = csvFromQueryResponse(queryResponse);

  const blob = new Blob([csvData], { type: 'data:text/csv;charset=utf-8,' });
  const blobURL = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = `openshift_logs.csv`;
  anchor.href = blobURL;
  anchor.dataset.downloadurl = ['text/csv', anchor.download, anchor.href].join(':');
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(blobURL);
  }, 100);
};
