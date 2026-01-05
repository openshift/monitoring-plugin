export enum QueryParams {
  Dashboard = 'dashboard',
  RefreshInterval = 'refreshInterval',
  TimeRange = 'timeRange',
  EndTime = 'endTime',
  Datasource = 'datasource',
  Project = 'project',
  Namespace = 'namespace',
  Units = 'units',
  // Use openshift-namespace query parameter for dashboards page since grafana variables cannot have
  // a `-` character in their name
  OpenshiftProject = 'project-dropdown-value',
}
