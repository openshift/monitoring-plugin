import { EmptyState, EmptyStateVariant, Spinner } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export const GraphEmpty: React.FC<GraphEmptyProps> = ({ minHeight = 180, loading = false }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <EmptyState
      variant={EmptyStateVariant.xs}
      style={{ minHeight }}
      headingLevel="h3"
      titleText={loading ? undefined : t('No data found')}
      icon={loading ? Spinner : undefined}
      isFullHeight
    />
  );
};

type GraphEmptyProps = {
  minHeight?: number | string;
  loading?: boolean;
};
