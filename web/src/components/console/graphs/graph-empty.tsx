import { EmptyState, EmptyStateBody, EmptyStateVariant } from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

export const GraphEmpty: React.FC<GraphEmptyProps> = ({ height = 180, loading = false }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        height,
        justifyContent: 'center',
        padding: '5px',
        width: '100%',
        flexGrow: 1,
      }}
    >
      {loading ? (
        <div className="skeleton-chart" data-test="skeleton-chart" />
      ) : (
        <EmptyState variant={EmptyStateVariant.xs}>
          <EmptyStateBody>{t('No data found')}</EmptyStateBody>
        </EmptyState>
      )}
    </div>
  );
};

type GraphEmptyProps = {
  height?: number | string;
  loading?: boolean;
};
