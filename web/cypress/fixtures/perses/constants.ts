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
  CREATE_DASHBOARD: 'Create Dashboard',
}

export enum persesDashboardsAddListVariableSource {
  STATIC_LIST_VARIABLE=  'Static List Variable',
  DATASOURCE_VARIABLE= 'Datasource Variable',
  PROMETHEUS_LABEL_VARIABLE= 'Prometheus Label Values Variable',
  PROMETHEUS_NAMES_VARIABLE= 'Prometheus Label Names Variable',
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

export const persesDashboardsAddPanelAddQueryType ={
  BAR_GAUGE_HEAT_HISTOGRAM_PIE_STAT_STATUS_TABLE_TIMESERIES : {
    CLICKHOUSE_TIME_SERIES_QUERY: 'ClickHouse Time Series Query',
    LOKI_TIME_SERIES_QUERY: 'Loki Time Series Query',
    PROMETHEUS_TIME_SERIES_QUERY: 'Prometheus Time Series Query',
    VICTORIALOGS_TIME_SERIES_QUERY: 'VictoriaLogs Time Series Query',
  },
  FLAME_CHART : {
    PYROSCOPE_PROFILE_QUERY: 'Pyroscope Profile Query',
  },
  LOGS_TABLE : {
    CLICKHOUSE_LOG_QUERY: 'ClickHouse Log Query',
    LOKI_LOG_QUERY: 'Loki Log Query',
    VICTORIALOGS_LOG_QUERY: 'Victorialogs Log Query',
  },
  SCATTER_TRACE_TRACINGGANTT : {
    TEMPO_TRACE_QUERY: 'Tempo Trace Query',
  },
}

export const persesCreateDashboard = {
  DIALOG_MAX_LENGTH_VALIDATION: 'Danger alert:bad request: code=400, message=cannot contain more than 75 characters, internal=cannot contain more than 75 characters',
  DIALOG_DUPLICATED_NAME_PF_VALIDATION_PREFIX: 'Dashboard name ',
  DIALOG_DUPLICATED_NAME_PF_VALIDATION_SUFFIX: ' already exists in this project: error status;',
  DIALOG_DUPLICATED_NAME_BKD_VALIDATION: 'Danger alert:document already exists',
}

export const persesDashboardsEmptyDashboard = {
  TITLE: 'Empty Dashboard',
  DESCRIPTION: 'To get started add something to your dashboard',
}

export const persesDashboardSampleQueries = {
  CPU_LINE_MULTI_SERIES: 'avg without (cpu)(rate(node_cpu_seconds_total{job=\'$job\',instance=\~\'$instance\',mode!=\"nice\",mode!=\"steal\",mode!=\"irq\"}[$interval]))',
  CPU_LINE_MULTI_SERIES_LEGEND: '{{}{{}mode{}}{}} mode - {{}{{}job{}}{}} {{}{{}instance{}}{}}',
  CPU_LINE_MULTI_SERIES_SERIES_SELECTOR: 'up{{}job=~"$job"{}}',
}

export const persesDashboardsRenameDashboard = {
  DIALOG_MAX_LENGTH_VALIDATION: 'Must be 75 or fewer characters long: error status;',
}

export const persesDashboardsDuplicateDashboard = {
  DIALOG_DUPLICATED_NAME_VALIDATION: "already exists", //use contains
}