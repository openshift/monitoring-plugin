import { Spinner } from '@patternfly/react-core';

export const Loading = ({ className }: LoadingProps) => (
  <div className={className} data-test="loading-indicator">
    <Spinner size="lg" />
  </div>
);
Loading.displayName = 'Loading';

type LoadingProps = {
  className?: string;
};
