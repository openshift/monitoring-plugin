/** @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';

import { PerspectiveName, UrlRootName } from '@/shared/constants/perspective';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { usePerspective } from '@/shared/hooks/usePerspective';
import { AlertSource } from '@/shared/types/types';

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useAccessReview: () => [true, false],
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
});
