/** @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';

import { PerspectiveName, UrlRootName } from '@/shared/constants/perspective';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getAlertsUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { AlertSource } from '@/shared/types/types';

const mocks = vi.hoisted(() => ({
  useActivePerspective: vi.fn(() => ['admin']),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useAccessReview: () => [true, false],
  useActivePerspective: mocks.useActivePerspective,
}));

const createWrapper = (pathname: string) => {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={[pathname]}>
        <MonitoringProvider
          monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
        >
          {children}
        </MonitoringProvider>
      </MemoryRouter>
    );
  };
};

describe('MonitoringContext perspective', () => {
  it.each([
    ['/monitoring/alerts/example', PerspectiveName.Admin, [AlertSource.Platform]],
    ['/dev-monitoring/ns/example/alerts/example', PerspectiveName.Developer, [AlertSource.User]],
    ['/virt-monitoring/alerts/example', PerspectiveName.Virtualization, [AlertSource.Platform]],
    ['/multicloud/monitoring/alerts/example', PerspectiveName.ACM, []],
  ])('uses the page route %s', (pathname, perspective, defaultAlertTenant) => {
    const { result } = renderHook(
      () => ({ monitoring: useMonitoring(), perspective: usePerspective() }),
      { wrapper: createWrapper(pathname) },
    );

    expect(
      result.current.monitoring.perspective,
      `MonitoringContext should derive the ${perspective} perspective from ${pathname}`,
    ).toBe(perspective);
    expect(
      result.current.perspective,
      'usePerspective should return the perspective, URL root, and default alert tenant for the page route',
    ).toMatchObject({
      perspective,
      urlRoot: UrlRootName[perspective],
      defaultAlertTenant,
    });
  });

  // Regression test for OU-1090: Console perspective changes must not break the ACM
  //  Alerts breadcrumb.
  it('keeps the ACM Alerts breadcrumb on ACM when the active Console perspective changes', () => {
    mocks.useActivePerspective.mockReturnValue(['acm']);
    const { result, rerender } = renderHook(() => usePerspective(), {
      wrapper: createWrapper('/multicloud/monitoring/alerts/example'),
    });

    expect(
      getAlertsUrl(result.current.perspective),
      'The ACM alert details breadcrumb should initially link to the ACM Alerts list',
    ).toBe('/multicloud/monitoring/alerts');

    mocks.useActivePerspective.mockReturnValue(['admin']);
    rerender();

    expect(
      result.current.perspective,
      'The page perspective should remain ACM after the active Console perspective changes to admin',
    ).toBe(PerspectiveName.ACM);
    expect(
      getAlertsUrl(result.current.perspective),
      'The ACM Alerts breadcrumb should retain its ACM URL after the Console perspective changes',
    ).toBe('/multicloud/monitoring/alerts');
    expect(
      mocks.useActivePerspective,
      'Route-bound perspective resolution should never consult the active Console perspective',
    ).not.toHaveBeenCalled();
  });
});
