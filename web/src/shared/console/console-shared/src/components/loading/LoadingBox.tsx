import type { FC, PropsWithChildren } from 'react';

import { ConsoleEmptyState } from '@/shared/console/console-shared/src/components/empty-state/ConsoleEmptyState';
import { Loading } from '@/shared/console/console-shared/src/components/loading/Loading';

export const LoadingBox: FC<PropsWithChildren> = ({ children }) => (
  <ConsoleEmptyState data-test="loading-box" isFullHeight>
    <Loading />
    {children}
  </ConsoleEmptyState>
);
LoadingBox.displayName = 'LoadingBox';
