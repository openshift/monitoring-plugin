import type { TdProps } from '@patternfly/react-table';

export type StartColumnsConfiguration = {
  expandColumn: Pick<TdProps, 'modifier' | 'isStickyColumn' | 'stickyMinWidth' | 'style'>;
  nameColumn: Pick<
    TdProps,
    'isStickyColumn' | 'hasRightBorder' | 'stickyMinWidth' | 'stickyLeftOffset'
  >;
};
