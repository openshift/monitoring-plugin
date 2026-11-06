import { ResourceLink } from '@openshift-console/dynamic-plugin-sdk';
import { DescriptionList } from '@patternfly/react-core';
import { t_global_spacer_lg } from '@patternfly/react-tokens';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AlertFollowUpSteps } from '@/features/alert-management-api/pages/alert-details/details-tab/AlertFollowUpSteps';
import { DetailsField } from '@/features/alert-management-api/pages/alert-details/details-tab/DetailsField';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { AlertState, AlertStateDescription } from '@/shared/components/AlertState';
import { Labels } from '@/shared/components/Labels';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { ExternalLink, LinkifyExternal } from '@/shared/console/utils/Link';
import { getRuleUrl } from '@/shared/hooks/usePerspective';
import { getSourceKey } from '@/shared/utils/alerts/alert-source';
import { startCase } from '@/shared/utils/strings';

export function DetailsTab({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { labels, annotations, rule } = alert;
  const description = annotations.description || annotations.summary || annotations.message;
  const name = labels.alertname || rule.name;

  return (
    <>
      <DescriptionList style={{ marginTop: t_global_spacer_lg.var }}>
        <DetailsField name={t('Name')} description={name} />
        {description && (
          <DetailsField
            name={t('Description')}
            description={<LinkifyExternal>{description}</LinkifyExternal>}
          />
        )}
        <DetailsField name={t('Alert scope')} description={<>{t(startCase(alert.alertScope))}</>} />
        <DetailsField name={t('Affected component')} description={<>{alert.component || '–'}</>} />
        <DetailsField
          name={t('State')}
          description={
            <>
              <AlertState state={alert.state} />
              <AlertStateDescription alert={alert} />
            </>
          }
        />
        <DetailsField name={t('Labels')} description={<Labels labels={labels} />} />
        <DetailsField
          name={t('Severity')}
          description={<SeverityBadge severity={labels.severity} />}
        />
        <DetailsField
          name={t('Source')}
          description={<>{getSourceKey(startCase(alert.source), t)}</>}
        />
        {labels.namespace && (
          <DetailsField
            name={t('Namespace')}
            description={<ResourceLink kind="Namespace" name={labels.namespace} />}
          />
        )}
        {labels.resource && (
          <DetailsField name={t('Resource')} description={<>{labels.resource}</>} />
        )}
        <DetailsField
          name={t('Alert rule')}
          description={<Link to={getRuleUrl('admin', rule)}>{rule.name}</Link>}
        />
        {annotations.runbook_url && (
          <DetailsField
            name={t('Runbook')}
            description={
              <ExternalLink href={annotations.runbook_url} text={annotations.runbook_url} />
            }
          />
        )}
        {annotations.dashboard_url && (
          <DetailsField
            name={t('Dashboard')}
            description={
              <ExternalLink href={annotations.dashboard_url} text={annotations.dashboard_url} />
            }
          />
        )}
      </DescriptionList>
      <AlertFollowUpSteps alert={alert} />
    </>
  );
}
