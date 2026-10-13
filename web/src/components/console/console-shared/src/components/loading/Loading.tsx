import { Spinner } from '@patternfly/react-core';
import type { FCC } from 'react';

export const Loading: FCC<LoadingProps> = ({ className }) => (
  <div className={className} data-test="loading-indicator">
    <Spinner size="lg" />
  </div>
);
Loading.displayName = 'Loading';

type LoadingProps = {
  className?: string;
};
