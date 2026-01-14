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

export const persesDashboardsModalTitles ={
  EDIT_DASHBOARD_VARIABLES: 'Edit Dashboard Variables',
  DASHBOARD_BUILT_IN_VARIABLES: 'Dashboard Built-in Variables',
  ADD_VARIABLE: 'Add Variable',
  EDIT_VARIABLE: 'Edit Variable',
  EDIT_DASHBOARD_DATASOURCES: 'Edit Dashboard Datasources',
  ADD_DATASOURCE: 'Add Datasource',
  EDIT_DATASOURCE: 'Edit Datasource',
  ADD_PANEL: 'Add Panel',
  EDIT_PANEL: 'Edit Panel',
  DELETE_PANEL: 'Delete Panel',
  ADD_PANEL_GROUP: 'Add Panel Group',
  EDIT_PANEL_GROUP: 'Edit Panel Group',
  DELETE_PANEL_GROUP: 'Delete Panel Group',
  EDIT_DASHBOARD_JSON: 'Edit Dashboard JSON',
  SAVE_DASHBOARD: 'Save Dashboard',
  DISCARD_CHANGES: 'Discard Changes',
  VIEW_JSON_DIALOG: 'Dashboard JSON',
}

export enum persesDashboardsAddListVariableSource {
  STATIC_LIST_VARIABLE=  'Static List Variable',
  DATASOURCE_VARIABLE= 'Datasource Variable',
  PROMETHEUS_LABEL_VARIABLE= 'Prometheus Label Variable',
  PROMETHEUS_NAMES_VARIABLE= 'Prometheus Names Variable',
  PROMETHEUS_PROMQL_VARIABLE= 'Prometheus PromQL Variable',
}

export enum persesDashboardsAddListVariableSort {
  NONE = 'None',
  ALPHABETICAL_ASC = 'Alphabetical, asc',
  ALPHABETICAL_DESC = 'Alphabetical, desc',
  NUMERICAL_ASC = 'Numerical, asc',
  NUMERICAL_DESC = 'Numerical, desc',
  ALPHABETICAL_CI_ASC = 'Alphabetical, case-insensitive, asc',
  ALPHABETICAL_CI_DESC = 'Alphabetical, case-insensitive, desc',
}

export const persesDashboardsRequiredFields = {
  AddVariableNameField: 'String must contain at least 1 character(s)'
}

export const persesDashboardsAddListPanelType = {
  BAR_CHART: 'Bar Chart',
  FLAME_CHART: 'Flame Chart',
  GAUGE_CHART: 'Gauge Chart',
  HEATMAP_CHART: 'HeatMap Chart',
  HISTOGRAM_CHART: 'Histogram Chart',
  MARKDOWN: 'Markdown',
  LOGS_TABLE: 'Logs Table',
  PIE_CHART: 'Pie Chart',
  SCATTER_CHART: 'Scatter Chart',
  STAT_CHART: 'Stat Chart',
  STATUS_HISTORY_CHART: 'Status History Chart',
  TABLE: 'Table',
  TIME_SERIES_CHART: 'Time Series Chart',
  TIME_SERIES_TABLE: 'Time Series Table',
  TRACE_TABLE: 'Trace Table',
  TRACING_GANTT_CHART: 'Tracing Gantt Chart',
}
