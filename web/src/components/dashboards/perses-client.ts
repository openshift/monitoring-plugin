import { cancellableFetch, CancellableFetch } from '../cancellable-fetch';

const baseURL = '/api/proxy/plugin/monitoring-console-plugin/perses';

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

export const fetchPersesDashboardsMetadata = (): CancellableFetch<PersesDashboardMetadata[]> => {
  const listDashboardsMetadata = '/api/v1/dashboards?metadata_only=true';
  const persesURL = `${baseURL}${listDashboardsMetadata}`;

  return cancellableFetch<PersesDashboardMetadata[]>(persesURL);
};
