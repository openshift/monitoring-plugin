import { Content, List, ListItem, Spinner, Title } from '@patternfly/react-core';
import { t_global_spacer_lg } from '@patternfly/react-tokens';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import CustomIcon from '@/shared/components/CustomIcon';
import { useAgenticRunCheck } from '@/shared/hooks/agentic-runs/useAgenticRunCheck';
import { getAgenticRunUrl, getQueryBrowserUrl } from '@/shared/hooks/usePerspective';

export function AlertFollowUpSteps({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { agenticRuns, hasAgenticRun, prefetch, isFetching } = useAgenticRunCheck(alert);
  useEffect(() => prefetch(), [prefetch]);
  const run = hasAgenticRun ? agenticRuns[0] : undefined;

  return (
    <Content style={{ marginTop: t_global_spacer_lg.var }}>
      <Title headingLevel="h3" size="md">
        {t('Follow-up steps')}
      </Title>
      <List isPlain>
        {alert.rule.query && (
          <ListItem>
            <Link to={getQueryBrowserUrl({ perspective: 'admin', query: alert.rule.query })}>
              {t('See metrics')}
            </Link>
          </ListItem>
        )}
        {run?.metadata?.name ? (
          <ListItem>
            <Link to={getAgenticRunUrl(run.metadata.namespace, run.metadata.name)}>
              {' '}
              <CustomIcon name="ai-experience" /> {t('View AI Investigation')}
            </Link>
            <Content component="small">
              {t('Always review AI-generated content prior to use.')}
            </Content>
          </ListItem>
        ) : (
          isFetching && (
            <ListItem>
              <Spinner size="sm" /> {t('Loading investigations...')}
            </ListItem>
          )
        )}
      </List>
    </Content>
  );
}
