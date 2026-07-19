import type { ComponentType } from 'react';

import ErrorBoundary from '@/shared/console/console-shared/error/error-boundary';

type WithFallback = <P = object>(
  Component: ComponentType<P>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FallbackComponent?: ComponentType<any>,
) => ComponentType<P>;

const withFallback: WithFallback = (WrappedComponent, FallbackComponent) => {
  const Component = (props) => (
    <ErrorBoundary FallbackComponent={FallbackComponent}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );
  Component.displayName = `withFallback(${WrappedComponent.displayName || WrappedComponent.name})`;
  return Component;
};

export default withFallback;
