export const PERSES_BASE_URL = '/api/proxy/plugin/monitoring-console-plugin/perses';

export type PersesDashboardMetadata = {
  kind: string; // kind: Dashboards
  metadata: {
    name: string; // name of dashboard
    created: string;
    updated: string;
    version: string;
    project: string; // name of project that holds the dashboard
  };
};
