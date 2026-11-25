import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
} from '@patternfly/react-core';
import { PendingIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import { useTempoResources } from '@/features/tracing/hooks/useTempoResources';

interface TempoInstanceNotReadyStateProps {
  /** message of the Tempo instance status explaining why the instance is not ready */
  statusMessage?: string;
}

/**
 * TempoInstanceNotReadyState is shown instead of the query results if the selected Tempo instance
 * is not ready yet. Querying an instance which is still starting up fails with a technical error
 * message from the gateway, which isn't actionable for the user.
 */
export function TempoInstanceNotReadyState({ statusMessage }: TempoInstanceNotReadyStateProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { isFetching, refetch } = useTempoResources();

  return (
    <EmptyState
      titleText={t('Tempo instance is not ready yet')}
      headingLevel="h4"
      icon={PendingIcon}
    >
      <EmptyStateBody>
        {t(
          'This Tempo instance is still starting up and cannot be queried yet. Traces will show up here once all of its components are ready.',
        )}
        {statusMessage && <div className="pf-v6-u-mt-sm">{statusMessage}</div>}
      </EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="link" isLoading={isFetching} onClick={() => refetch()}>
            {t('Check again')}
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
}
