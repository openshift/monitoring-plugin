/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryParamProvider } from 'use-query-params';

import { useDetailsTabState } from '@/features/alert-management-api/hooks/useDetailsTabState';
import { ReactRouter7Adapter } from '@/shared/utils/react-router-7-adapter';

function setup(search: string, tabCount = 2) {
  return renderHook(() => ({ ...useDetailsTabState(tabCount), search: useLocation().search }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[`/${search}`]}>
        <QueryParamProvider adapter={ReactRouter7Adapter}>{children}</QueryParamProvider>
      </MemoryRouter>
    ),
  });
}

it.each(['', '?tab=invalid', '?tab=-1', '?tab=1.5', '?tab=2', '?tab=Infinity'])(
  'defaults to the first tab for %s',
  (search) => {
    const { result } = setup(search);
    expect(
      result.current.activeTab,
      'Missing or invalid tab values should select the first tab',
    ).toBe(0);
  },
);

it('restores the selected tab from the URL', () => {
  const { result } = setup('?tab=1');
  expect(result.current.activeTab, 'The URL should determine the initial selected tab').toBe(1);
});

it('updates the numeric tab parameter without changing other parameters', () => {
  const { result } = setup('?alertRuleID=rule&severity=critical&severity=warning');
  act(() => result.current.setActiveTab(1));
  expect(result.current.activeTab, 'Selecting a tab should update the active tab').toBe(1);
  const params = new URLSearchParams(result.current.search);
  expect(params.get('tab'), 'The selected tab should be persisted in the URL').toBe('1');
  expect(params.get('alertRuleID'), 'Changing tabs should preserve the alert rule ID').toBe('rule');
  expect(params.getAll('severity'), 'Changing tabs should preserve all severity filters').toEqual([
    'critical',
    'warning',
  ]);

  act(() => result.current.setActiveTab(0));
  expect(result.current.activeTab, 'Selecting the first tab should reset the active tab').toBe(0);
  expect(
    new URLSearchParams(result.current.search).get('tab'),
    'The first tab should be encoded as 0',
  ).toBe('0');
});
