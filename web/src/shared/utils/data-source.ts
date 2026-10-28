import type { DataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';

export const isDataSource = (extension: { type: string }): extension is DataSource =>
  extension.type === 'console.dashboards/datasource';
