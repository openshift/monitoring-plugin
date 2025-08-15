export enum AlertsAlertState {
  FIRING = 'Firing',
  PENDING = 'Pending',
  SILENCED = 'Silenced',
};

export enum AlertingRulesAlertState {
  FIRING = 'Firing',
  PENDING = 'Pending',
  SILENCED = 'Silenced',
  NOT_FIRING = 'Not Firing',
};

export enum Severity {
  CRITICAL = 'Critical',
  WARNING = 'Warning',
  INFO = 'Info',
  NONE = 'None',
};

export enum Source {
  PLATFORM = 'Platform',
  USER = 'User',
};

export enum GraphTimespan {
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  TWO_HOURS = '2h',
  SIX_HOURS = '6h',
  TWELVE_HOURS = '12h',
  ONE_DAY = '1d',
  TWO_DAYS = '2d',
  ONE_WEEK = '1w',
  TWO_WEEKS = '2w',
};

export enum MetricsPageUnits {
  NO_UNITS = 'No Units',
  BYTES_BINARY = 'Bytes Binary (KiB, MiB)',
  BYTES_DECIMAL = 'Bytes Decimal (kb, MB)',
  BYTES_BINARY_PER_SECOND = 'Bytes Binary Per Second (KiB/s, MiB/s)',
  BYTES_DECIMAL_PER_SECOND = 'Bytes Decimal Per Second (kB/s, MB/s)',
  PACKETS_PER_SECOND = 'Packets Per Second',
  MILISECONDS = 'Miliseconds',
  SECONDS = 'Seconds',
  PERCENTAGE = 'Percentage',
};

export enum MetricsPageRefreshInterval {
  REFRESH_OFF = 'Refresh off',
  FIFTEEN_SECONDS = '15 seconds',
  THIRTY_SECONDS = '30 seconds',
  ONE_MINUTE = '1 minute',
  FIFTEEN_MINUTES = '15 minutes',
  ONE_HOUR = '1 hour',
  TWO_HOURS = '2 hours',
  ONE_DAY = '1 day',
};

export enum MetricsPagePredefinedQueries {
  CPU_USAGE = 'CPU Usage',
  MEMORY_USAGE = 'Memory Usage',
  FILESYSTEM_USAGE = 'Filesystem Usage',
  RECEIVE_BANDWIDTH = 'Receive bandwidth',
  TRANSMIT_BANDWIDTH = 'Transmit bandwidth',
  RATE_OF_RECEIVED_PACKETS = 'Rate of received packets',
  RATE_OF_TRANSMITTED_PACKETS = 'Rate of transmitted packets',
  RATE_OF_RECEIVED_PACKETS_DROPPED = 'Rate of received packets dropped',
  RATE_OF_TRANSMITTED_PACKETS_DROPPED = 'Rate of transmitted packets dropped',
};

export enum MetricsPageQueryInput {
  EXPRESSION_PRESS_SHIFT_ENTER_FOR_NEWLINES = 'Expression (press Shift+Enter for newlines)',
  INSERT_EXAMPLE_QUERY = 'sort_desc(sum(sum_over_time(ALERTS{alertstate="firing"}[24h])) by (alertname))',
}

export enum MetricsPageActions {
  ADD_QUERY = 'Add query',
  DELETE_ALL_QUERIES = 'Delete all queries',
  EXPAND_ALL_QUERY_TABLES = 'Expand all query tables',
  COLLAPSE_ALL_QUERY_TABLES = 'Collapse all query tables',
}

export enum MetricGraphEmptyState {
  NO_DATAPOINTS_FOUND = 'No datapoints found.',
  NO_QUERY_ENTERED = 'No query entered',
  ENTER_QUERY = 'Enter a query in the box below to explore metrics for this cluster.',
}

export enum MetricsPageQueryKebabDropdown{
  DISABLE_ENABLE_QUERY = 'Disable query',
  HIDE_ALL_SERIES = 'Hide all series',
  SHOW_ALL_SERIES = 'Show all series',
  DELETE_QUERY = 'Delete query',
  DUPLICATE_QUERY = 'Duplicate query',
  EXPORT_AS_CSV = 'Export as CSV',
}