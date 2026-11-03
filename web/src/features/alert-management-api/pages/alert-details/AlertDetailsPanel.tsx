import {
  Card,
  CardBody,
  Flex,
  Label,
  Stack,
  StackItem,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core';
import { t_global_spacer_lg } from '@patternfly/react-tokens';
import { useTranslation } from 'react-i18next';

import { useDetailsTabState } from '@/features/alert-management-api/hooks/useDetailsTabState';
import { DetailsTab } from '@/features/alert-management-api/pages/alert-details/details-tab/DetailsTab';
import { TimelineTab } from '@/features/alert-management-api/pages/alert-details/timeline-tab/TimelineTab';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';

export function AlertDetailsPanel({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { activeTab, setActiveTab } = useDetailsTabState(2);
  const namespace = alert.labels.namespace;

  return (
    <Stack hasGutter style={{ paddingBottom: t_global_spacer_lg.var }}>
      {namespace && (
        <StackItem>
          <Card isCompact variant="secondary" role="region" aria-label={t('Namespace')}>
            <CardBody>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <Label isCompact>{t('Namespace')}</Label>
                <strong>{namespace}</strong>
              </Flex>
            </CardBody>
          </Card>
        </StackItem>
      )}
      <StackItem>
        <Tabs
          activeKey={activeTab}
          onSelect={(_event, key) => setActiveTab(Number(key))}
          aria-label={t('Alert details')}
        >
          <Tab eventKey={0} title={<TabTitleText>{t('Details')}</TabTitleText>}>
            <DetailsTab alert={alert} />
          </Tab>
          <Tab eventKey={1} title={<TabTitleText>{t('Alert timeline')}</TabTitleText>}>
            {activeTab === 1 && <TimelineTab alert={alert} />}
          </Tab>
        </Tabs>
      </StackItem>
    </Stack>
  );
}
