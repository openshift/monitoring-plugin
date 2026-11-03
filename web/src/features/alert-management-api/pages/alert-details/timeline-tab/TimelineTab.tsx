import { Content, Title } from '@patternfly/react-core';
import { t_global_spacer_lg, t_global_spacer_md } from '@patternfly/react-tokens';
import { useTranslation } from 'react-i18next';

import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { AlertGraph } from '@/shared/components/AlertGraph';

export function TimelineTab({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { labels, rule } = alert;

  return (
    <Content style={{ marginTop: t_global_spacer_lg.var }}>
      <Title headingLevel="h3" size="md" style={{ marginBottom: t_global_spacer_md.var }}>
        {t('Alert timeline')}
      </Title>
      <AlertGraph filterLabels={labels} query={rule.query} ruleDuration={rule.duration} />
    </Content>
  );
}
