/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { PageWithFilters } from '@/features/alert-management-api/components/PageWithFilters';
import { DataTestIDs } from '@/shared/constants/data-test';

it('keeps results mounted while the PatternFly sidebar is toggled', () => {
  const { container, rerender } = render(
    <PageWithFilters
      filters={<div>Filter controls</div>}
      filtersId={DataTestIDs.AlertManagementAPI.FiltersPanel}
    >
      Results
    </PageWithFilters>,
  );
  const content = screen.getByText('Results');
  expect(
    container.querySelector('.pf-v6-c-sidebar__panel')?.id,
    'the expanded sidebar should use the supplied filters ID',
  ).toBe(DataTestIDs.AlertManagementAPI.FiltersPanel);

  rerender(
    <PageWithFilters filtersId={DataTestIDs.AlertManagementAPI.FiltersPanel}>
      Results
    </PageWithFilters>,
  );
  expect(
    container.querySelector('.pf-v6-c-sidebar__panel'),
    'the sidebar panel should be absent without filters',
  ).toBeNull();
  expect(
    screen.getByText('Results'),
    'toggling the sidebar should preserve the mounted results node',
  ).toBe(content);
});
