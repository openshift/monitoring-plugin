import type { DashboardResource } from '@perses-dev/client';

export type DashboardMetadata = {
  name: string;
  project: string;
  tags: string[];
  title: string;
  persesDashboard: DashboardResource;
};
