import type { FC, ComponentType, ReactElement } from 'react';
import {
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateVariant,
  EmptyState,
  EmptyStateProps,
} from '@patternfly/react-core';

export const ConsoleEmptyState: FC<ConsoleEmptyStateProps> = ({
  children,
  Icon,
  primaryActions,
  secondaryActions,
  title,
  ...props
}) => {
  const dataTest = props['data-test'] || 'console-empty-state';
  const variant = props.variant || EmptyStateVariant.xs;
  const body = children && (
    <EmptyStateBody data-test={`${dataTest}-body`}>{children}</EmptyStateBody>
  );
  const footer = (primaryActions || secondaryActions) && (
    <EmptyStateFooter data-test={`${dataTest}-footer`}>
      {primaryActions?.length > 0 && (
        <EmptyStateActions data-test={`${dataTest}-primary-actions`}>
          {primaryActions}
        </EmptyStateActions>
      )}
      {secondaryActions?.length > 0 && (
        <EmptyStateActions data-test={`${dataTest}-secondary-actions`}>
          {secondaryActions}
        </EmptyStateActions>
      )}
    </EmptyStateFooter>
  );
  return (
    <EmptyState variant={variant} data-test={dataTest} icon={Icon} titleText={title} {...props}>
      {body}
      {footer}
    </EmptyState>
  );
};
ConsoleEmptyState.displayName = 'ConsoleEmptyState';

type ConsoleEmptyStateProps = Partial<EmptyStateProps> & {
  className?: string;
  'data-test'?: string;
  Icon?: ComponentType;
  primaryActions?: ReactElement[];
  secondaryActions?: ReactElement[];
  title?: string | ReactElement;
  variant?: EmptyStateVariant;
};
