export enum persesDashboardsTimeRange {
  CUSTOM_TIME_RANGE = 'Custom Time Range',
  LAST_5_MINUTES = 'Last 5 minutes',
  LAST_15_MINUTES = 'Last 15 minutes',
  LAST_30_MINUTES = 'Last 30 minutes',
  LAST_1_HOUR = 'Last 1 hour',
  LAST_6_HOURS = 'Last 6 hours',
  LAST_12_HOURS = 'Last 12 hours',
  LAST_24_HOURS = 'Last 24 hours',
  LAST_7_DAYS = 'Last 7 days',
  LAST_14_DAYS = 'Last 14 days',
}

export enum persesDashboardsRefreshInterval {
  OFF = 'Off',
  FIVE_SECONDS = '5s',
  TEN_SECONDS = '10s',
  FIFTEEN_SECONDS = '15s',
  THIRTY_SECONDS = '30s',
  ONE_MINUTE = '1m',
}

export const persesDashboardsDashboardDropdownCOO = {
  ACCELERATORS_COMMON_METRICS:['Accelerators common metrics', 'perses', 'accelerators-dashboard'],
  APM_DASHBOARD: ['Application Performance Monitoring (APM)', 'perses', 'apm-dashboard'],
  K8S_COMPUTE_RESOURCES_CLUSTER: ['Kubernetes / Compute Resources / Cluster', 'perses', 'openshift-cluster-sample-dashboard'],
}

export const persesDashboardsDashboardDropdownPersesDev = {
  PERSES_DASHBOARD_SAMPLE: ['Perses Dashboard Sample', 'perses', 'perses-dashboard-sample'],
  PROMETHEUS_OVERVIEW: ['Prometheus / Overview', 'perses', 'prometheus-overview'],
  THANOS_COMPACT_OVERVIEW: ['Thanos / Compact / Overview', 'perses', 'thanos-compact-overview'],
}

export enum persesDashboardsAcceleratorsCommonMetricsPanels {
  GPU_UTILIZATION = 'GPU Utilization',
  MEMORY_USED_BYTES = 'Memory Used Bytes',
  MEMORY_TOTAL_BYTES = 'Memory Total Bytes',
  POWER_USAGE_WATTS = 'Power Usage (Watts)',
  TEMPERATURE_CELCIUS = 'Temperature (Celsius)',
  SM_CLOCK_HERTZ = 'SM Clock (Hertz)',
  MEMORY_CLOCK_HERTZ = 'Memory Clock (Hertz)',
}

export const listPersesDashboardsPageSubtitle = 'View and manage dashboards.';

export const listPersesDashboardsEmptyState = {
  TITLE: 'No results found',
  BODY: 'No results match the filter criteria. Clear filters to show results.',

}