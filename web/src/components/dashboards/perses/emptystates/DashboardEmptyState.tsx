import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  Bullseye,
  EmptyStateIcon,
  EmptyStateHeader,
} from '@patternfly/react-core';
import { ListIcon } from '@patternfly/react-icons';

import { useTranslation } from 'react-i18next';
import { ExternalLink } from '../../../console/utils/link';

export function DashboardEmptyState(): React.ReactElement {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Bullseye>
      <EmptyState>
        <EmptyStateHeader
          titleText={t('No Dashboard Available in Selected Project')}
          headingLevel="h2"
          icon={<EmptyStateIcon icon={ListIcon} />}
        />
        <EmptyStateBody>
          {t('To explore data, create a dashboard for this project')}
          <ExternalLink href={'https://github.com/perses/perses-operator'} />
        </EmptyStateBody>
      </EmptyState>
    </Bullseye>
  );
}
