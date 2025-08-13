import type { FC } from 'react';
import { Loading } from './Loading';
import { ConsoleEmptyState } from '../empty-state/ConsoleEmptyState';

export const LoadingBox: FC = ({ children }) => (
  <ConsoleEmptyState data-test="loading-box" isFullHeight>
    <Loading />
    {children}
  </ConsoleEmptyState>
);
LoadingBox.displayName = 'LoadingBox';
