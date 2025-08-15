import type { FC } from 'react';
import { Button } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ConsoleEmptyState } from '../empty-state/ConsoleEmptyState';

export const LoadError: FC<LoadErrorProps> = ({ label, children, canRetry = true }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const actions = canRetry
    ? [
        <Button
          key="try-again"
          type="button"
          onClick={() => window.location.reload()}
          variant="link"
          isInline
        >
          {t('Try again')}
        </Button>,
      ]
    : [];
  return (
    <ConsoleEmptyState primaryActions={actions} title={t('Error loading {{label}}', { label })}>
      {children}
    </ConsoleEmptyState>
  );
};
LoadError.displayName = 'LoadError';

type LoadErrorProps = {
  label: string;
  canRetry?: boolean;
};
