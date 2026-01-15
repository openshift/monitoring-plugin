import { DashboardResource } from '@perses-dev/core';

export const generateMetadataName = (name: string): string => {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
};

export const createNewDashboard = (
  dashboardName: string,
  projectName: string,
): DashboardResource => {
  return {
    kind: 'Dashboard',
    metadata: {
      name: generateMetadataName(dashboardName),
      project: projectName,
      version: 0,
    },
    spec: {
      display: {
        name: dashboardName,
      },
      datasources: {},
      panels: {},
      layouts: [],
      variables: [],
      duration: '1h',
      refreshInterval: '30s',
    },
  };
};
