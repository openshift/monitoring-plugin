/** @vitest-environment jsdom */

import { useQuery } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

import {
  useGetAlerts,
  useGetHealth,
  useGetRules,
} from '@/shared/clients/alert-management-api/generated/api';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn(() => ({})) }));
vi.mock('@/shared/clients/alert-management-api/transport', () => ({
  alertManagementFetch: vi.fn(),
}));

it('allows the generated rules hook to be called without any arguments', () => {
  const { result } = renderHook(() => useGetRules());

  expect(result.current.queryKey).toEqual(['/rules']);
});

it('accepts only options without a placeholder for params', () => {
  renderHook(() => useGetRules({ options: { query: { refetchInterval: 30_000 } } }));

  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryKey: ['/rules'], refetchInterval: 30_000 }),
  );
});

it('accepts only params without requiring options', () => {
  const params = { state: 'firing' as const };
  const { result } = renderHook(() => useGetRules({ params }));

  expect(result.current.queryKey).toEqual(['/rules', params]);
});

it('accepts params and options together for the generated alerts hook', () => {
  const params = { state: 'silenced' as const };
  renderHook(() => useGetAlerts({ params, options: { query: { enabled: false } } }));

  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryKey: ['/alerts', params], enabled: false }),
  );
});

it('uses the same options shape for a query without params', () => {
  renderHook(() => useGetHealth({ options: { query: { refetchInterval: false } } }));

  expect(useQuery).toHaveBeenLastCalledWith(
    expect.objectContaining({ queryKey: ['/health'], refetchInterval: false }),
  );
});

it('preserves type inference from query options', () => {
  const { result } = renderHook(() =>
    useGetRules({ options: { query: { select: (response) => response.data.groups.length } } }),
  );

  expectTypeOf(result.current.data).toEqualTypeOf<number | undefined>();
});
