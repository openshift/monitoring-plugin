import { Spinner } from '@patternfly/react-core';
import * as React from 'react';

export const Loading: React.FCC<LoadingProps> = ({ className }) => (
  <div className={className} data-test="loading-indicator">
    <Spinner size="lg" />
  </div>
);
Loading.displayName = 'Loading';

type LoadingProps = {
  className?: string;
};
