import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { CubesIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

export function NoTempoInstanceSelectedState() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <EmptyState titleText={t('No Tempo instance selected')} headingLevel="h4" icon={CubesIcon}>
      <EmptyStateBody>
        {t('To explore data, select a Tempo instance and run a query.')}
      </EmptyStateBody>
    </EmptyState>
  );
}
