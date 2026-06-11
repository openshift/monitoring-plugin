import { Spinner } from '@patternfly/react-core';
import type { FCC } from 'react';

// eslint-disable-next-line react/prop-types
export const Loading: FCC<LoadingProps> = ({ className }) => (
  <div className={className} data-test="loading-indicator">
    <Spinner size="lg" />
  </div>
);
Loading.displayName = 'Loading';

type LoadingProps = {
  className?: string;
};
