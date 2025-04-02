import * as React from 'react';
import classNames from 'classnames';

export const Loading: React.FCC<LoadingProps> = ({ className }) => (
  // Leave to keep compatibility with console looks
  // Should be removed in the 4.19 update
  <div
    className={classNames('co-m-loader co-an-fade-in-out', className)}
    data-test="loading-indicator"
  >
    <div className="co-m-loader-dot__one" />
    <div className="co-m-loader-dot__two" />
    <div className="co-m-loader-dot__three" />
  </div>
);
Loading.displayName = 'Loading';

type LoadingProps = {
  className?: string;
};
