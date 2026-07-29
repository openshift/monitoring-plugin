import type { DashboardResource } from '@perses-dev/core';

export type DashboardMetadata = {
  name: string;
  project: string;
  tags: string[];
  title: string;
  persesDashboard: DashboardResource;
};
