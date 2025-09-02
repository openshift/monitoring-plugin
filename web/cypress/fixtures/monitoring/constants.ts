export enum MonitoringPageTitles {
  METRICS = 'Metrics',
  DASHBOARDS = 'Dashboards',
  TARGETS = 'Targets',
  CREATE_SILENCE = 'Create silence',
  RECREATE_SILENCE = 'Recreate silence',
  EDIT_SILENCE = 'Edit silence',
  SILENCE_ALERT = 'Silence alert',
};

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

export enum MonitoringRefreshInterval {
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
  VECTOR_QUERY='vector(1)',
  CPU_USAGE = 'OpenShift_Metrics_QueryTable_sum(node_namespace_pod_container_container_cpu_usage_seconds_total_sum_irate) by (pod).csv',
  MEMORY_USAGE = 'OpenShift_Metrics_QueryTable_sum(container_memory_working_set_bytes{container!=__}) by (pod).csv',
  FILESYSTEM_USAGE = 'OpenShift_Metrics_QueryTable_topk(25, sort_desc(sum(pod_container_fs_usage_bytes_sum{container=__,pod!=__}) BY (pod, namespace))).csv',
  RECEIVE_BANDWIDTH = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_receive_bytes_total[2h])) by (pod).csv',
  TRANSMIT_BANDWIDTH = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_transmit_bytes_total[2h])) by (pod).csv',
  RATE_OF_RECEIVED_PACKETS = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_receive_packets_total[2h])) by (pod).csv',
  RATE_OF_TRANSMITTED_PACKETS = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_transmit_packets_total[2h])) by (pod).csv',
  RATE_OF_RECEIVED_PACKETS_DROPPED = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_receive_packets_dropped_total[2h])) by (pod).csv',
  RATE_OF_TRANSMITTED_PACKETS_DROPPED = 'OpenShift_Metrics_QueryTable_sum(irate(container_network_transmit_packets_dropped_total[2h])) by (pod).csv',
  API_REQUEST_DURATION_BY_VERB_99TH_PERCENTILE_QUERY = 'histogram_quantile(0.99, sum(resource_verb:apiserver_request_duration_seconds_bucket:rate:5m{apiserver="kube-apiserver"}) by (verb, le))',
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
  UNGRAPHABLE_RESULTS = 'Ungraphable results',
  UNGRAPHABLE_RESULTS_DESCRIPTION = 'The resulting dataset is too large to graph.',
}

export enum MetricsPageQueryKebabDropdown{
  DISABLE_QUERY = 'Disable query',
  ENABLE_QUERY = 'Enable query',
  HIDE_ALL_SERIES = 'Hide all series',
  SHOW_ALL_SERIES = 'Show all series',
  DELETE_QUERY = 'Delete query',
  DUPLICATE_QUERY = 'Duplicate query',
  EXPORT_AS_CSV = 'Export as CSV',
}

export enum LegacyDashboardsTimeRange {
  CUSTOM_TIME_RANGE = 'Custom time range',
  LAST_5_MINUTES = 'Last 5 minutes',
  LAST_15_MINUTES = 'Last 15 minutes',
  LAST_30_MINUTES = 'Last 30 minutes',
  LAST_1_HOUR = 'Last 1 hour',
  LAST_2_HOURS = 'Last 2 hours',
  LAST_6_HOURS = 'Last 6 hours',
  LAST_12_HOURS = 'Last 12 hours',
  LAST_1_DAY = 'Last 1 day',
  LAST_2_DAYS = 'Last 2 days',
  LAST_1_WEEK = 'Last 1 week',
  LAST_2_WEEKS = 'Last 2 weeks',
}

export const LegacyDashboardsDashboardDropdown = {
API_PERFORMANCE: ['API Performance', ''],
ETCD: ['etcd', 'etcd-mixin'],
K8S_COMPUTE_RESOURCES_CLUSTER: ['Kubernetes / Compute Resources / Cluster', 'kubernetes-mixin'],
K8S_COMPUTE_RESOURCES_NAMESPACE_PODS: ['Kubernetes / Compute Resources / Namespace (Pods)', 'kubernetes-mixin'],
K8S_COMPUTE_RESOURCES_NAMESPACE_WORKLOADS: ['Kubernetes / Compute Resources / Namespace (Workloads)', 'kubernetes-mixin'],
K8S_COMPUTE_RESOURCES_NODE_PODS: ['Kubernetes / Compute Resources / Node (Pods)', 'kubernetes-mixin'],
K8S_COMPUTE_RESOURCES_POD: ['Kubernetes / Compute Resources / Pod', 'kubernetes-mixin'],
K8S_COMPUTE_RESOURCES_WORKLOAD: ['Kubernetes / Compute Resources / Workload', 'kubernetes-mixin'],
K8S_NETWORKING_CLUSTER: ['Kubernetes / Networking / Cluster', 'kubernetes-mixin'],
K8S_NETWORKING_NAMESPACE_PODS: ['Kubernetes / Networking / Namespace (Pods)', 'kubernetes-mixin'],
K8S_NETWORKING_POD: ['Kubernetes / Networking / Pod', 'kubernetes-mixin'],
NETWORKING_INFRASTRUCTURE: ['Networking / Infrastructure', 'networking-mixin'],
NETWORKING_INGRESS: ['Networking / Ingress', 'networking-mixin'],
NETWORKING_LINUX_SUBSYSTEM_STATS: ['Networking / Linux Subsystem Stats', 'networking-mixin'],
NODE_CLUSTER: ['Node Cluster', ''],
NODE_EXPORTER_USE_METHOD_CLUSTER: ['Node Exporter / USE Method / Cluster', 'node-exporter-mixin'],
NODE_EXPORTER_USE_METHOD_NODE: ['Node Exporter / USE Method / Node', 'node-exporter-mixin'],
PROMETHEUS_OVERVIEW: ['Prometheus / Overview', 'prometheus-mixin'],
}

export enum API_PERFORMANCE_DASHBOARD_PANELS {
  API_PERFORMANCE_PANEL_1 = 'API Request Duration by Verb - 99th Percentile',
  API_PERFORMANCE_PANEL_2 = 'etcd Request Duration - 99th Percentile',
  API_PERFORMANCE_PANEL_3 = 'Request Duration by Resource and Verb - 99th Percentile',
  API_PERFORMANCE_PANEL_4 = 'Request Rate by Resource and Verb',
  API_PERFORMANCE_PANEL_5 = 'Request Duration by Read vs Write - 99th Percentile',
  API_PERFORMANCE_PANEL_6 = 'Request Rate by Read vs Write',
  API_PERFORMANCE_PANEL_7 = 'Requests Dropped Rate',
  API_PERFORMANCE_PANEL_8 = 'Requests Terminated Rate',
  API_PERFORMANCE_PANEL_9 = 'Request Rate by Status',
  API_PERFORMANCE_PANEL_10 = 'Request Rate by Instance',
  API_PERFORMANCE_PANEL_11 = 'Long Running Requests by Resource',
  API_PERFORMANCE_PANEL_12 = 'Long Running Requests by Instance',
  API_PERFORMANCE_PANEL_13 = 'Requests in Flight',
  API_PERFORMANCE_PANEL_14 = 'Response Bytes per Second by Instance',
  API_PERFORMANCE_PANEL_15 = 'Response Bytes per Second by Resource and Verb',
  API_PERFORMANCE_PANEL_16 = 'Priority & Fairness: Requests Rejected',
}