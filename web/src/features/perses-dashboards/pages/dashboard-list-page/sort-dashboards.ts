import type { DashboardResource } from '@perses-dev/client';
import type { ReactNode } from 'react';

import { rowFilter } from '@/shared/components/table/hooks/useTableFilters';
import { directedSort, localeCompareSort } from '@/shared/components/table/sort-utils';

export interface DashboardRowNameLink {
  link: ReactNode;
  label: string;
}

export interface DashboardRow {
  name: DashboardRowNameLink;
  id: string;
  tags: ReactNode;
  project: string;
  created: ReactNode;
  modified: ReactNode;
  // Raw values for sorting
  createdAt?: string;
  updatedAt?: string;
  // Reference to original dashboard data
  dashboard: DashboardResource;
}

export const sortDashboardData = (
  data: DashboardRow[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
): DashboardRow[] => {
  if (!sortBy || !direction) {
    return data;
  }
  if (sortBy === rowFilter('name')) {
    return [...data].sort((a, b) => localeCompareSort(a.name.label, b.name.label, direction));
  }
  if (sortBy === rowFilter('id')) {
    return [...data].sort((a, b) => localeCompareSort(a.id, b.id, direction));
  }
  if (sortBy === rowFilter('project')) {
    return [...data].sort((a, b) => localeCompareSort(a.project, b.project, direction));
  }
  if (sortBy === rowFilter('created')) {
    return [...data].sort((a, b) => localeCompareSort(a.createdAt, b.createdAt, direction));
  }
  if (sortBy === rowFilter('modified')) {
    return [...data].sort((a, b) => localeCompareSort(a.updatedAt, b.updatedAt, direction));
  }
  if (sortBy === rowFilter('tags')) {
    return [...data].sort((a, b) =>
      directedSort(
        (a.dashboard.metadata?.tags?.length || 0) - (b.dashboard.metadata?.tags?.length || 0),
        direction,
      ),
    );
  }

  return data;
};
