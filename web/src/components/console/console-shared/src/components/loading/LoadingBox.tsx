import type { FC, PropsWithChildren } from 'react';
import { Loading } from './Loading';
import { ConsoleEmptyState } from '../empty-state/ConsoleEmptyState';

export const LoadingBox: FC<PropsWithChildren> = ({ children }) => (
  <ConsoleEmptyState data-test="loading-box" isFullHeight>
    <Loading />
    {children}
  </ConsoleEmptyState>
);
LoadingBox.displayName = 'LoadingBox';
