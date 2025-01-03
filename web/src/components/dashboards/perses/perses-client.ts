import { proxiedFetch } from '../../proxied-fetch';

const baseURL = '/api/proxy/plugin/monitoring-console-plugin/perses';

// TODO: Migrate these type definitions to just the perses typescript definitions
export type PersesDashboardMetadata = {
  kind: 'Dashboards'; // kind: Dashboards
  metadata: {
    name: string; // name of dashboard
    created: string;
    updated: string;
    version: string;
    project: string; // name of project that holds the dashboard
  };
};

export type PersesProject = {
  kind: 'Project';
  metadata: {
    name: string;
    createdAt: string; // ISO 8601 datetime
    updatedAt: string; // ISO 8601 datetime
    version: number;
  };
  spec: {
    display: {
      name: string;
    };
  };
};

export const fetchPersesDashboardsMetadata = (): Promise<PersesDashboardMetadata[]> => {
  const listDashboardsMetadata = '/api/v1/dashboards?metadata_only=true';
  const persesURL = `${baseURL}${listDashboardsMetadata}`;

  return proxiedFetch<PersesDashboardMetadata[]>(persesURL);
};

export const fetchPersesProjects = (): Promise<PersesProject[]> => {
  const listProjectURL = '/api/v1/projects';
  const persesURL = `${baseURL}${listProjectURL}`;

  return proxiedFetch<PersesProject[]>(persesURL);
};
