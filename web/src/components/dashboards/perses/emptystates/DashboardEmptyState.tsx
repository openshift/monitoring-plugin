import { ReactElement } from 'react';
import { Title, EmptyState, EmptyStateBody, Bullseye } from '@patternfly/react-core';
import { ListIcon } from '@patternfly/react-icons';

import { useTranslation } from 'react-i18next';
import { ExternalLink } from '../../../console/utils/link';

export function DashboardEmptyState(): ReactElement {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Bullseye>
      <EmptyState
        titleText={
          <Title headingLevel="h2" size="lg">
            {t('No Dashboard Available in Selected Project')}
          </Title>
        }
        icon={ListIcon}
      >
        <EmptyStateBody>
          {t('To explore data, create a dashboard for this project')}
          <ExternalLink href={'https://github.com/perses/perses-operator'} />
        </EmptyStateBody>
      </EmptyState>
    </Bullseye>
  );
}
