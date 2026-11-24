import { ActionServiceProvider, AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import {
  Content,
  ContentVariants,
  Divider,
  DropdownItem,
  Flex,
  FlexItem,
  Spinner,
} from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';

import { useSilenceAlertNavigation } from '@/features/alert-management-api/hooks/useSilenceAlertNavigation';
import { AlertActionItem } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertActionItem';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import {
  getAlertRuleDetailsUrl,
  getCreateSilenceUrl,
} from '@/features/alert-management-api/utils/urls';
import CustomIcon from '@/shared/components/CustomIcon';
import KebabDropdown from '@/shared/components/KebabDropdown';
import { DataTestIDs } from '@/shared/constants/data-test';
import { useAgenticRunCheck } from '@/shared/hooks/agentic-runs/useAgenticRunCheck';
import { useMonitoring } from '@/shared/hooks/useMonitoring';
import { getAgenticRunUrl, getQueryBrowserUrl } from '@/shared/hooks/usePerspective';

export function AlertActions({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { useAlertsTenancy, accessCheckLoading } = useMonitoring();
  const { namespace } = alert.labels;

  const name = alert.labels.alertname ?? alert.rule.name;

  const { agenticRuns, hasAgenticRun, prefetch, isFetching } = useAgenticRunCheck(alert);
  const run = hasAgenticRun ? agenticRuns[0] : undefined;
  const { navigateToSilence } = useSilenceAlertNavigation();

  const dropdownItems = [];

  if (alert.state !== AlertStates.Silenced) {
    dropdownItems.push(
      <AlertActionItem
        key="silence-alert"
        accessReview={
          useAlertsTenancy && namespace
            ? {
                group: 'monitoring.coreos.com',
                resource: 'prometheusrules',
                verb: 'create',
                namespace,
              }
            : {
                group: 'monitoring.coreos.com',
                resource: 'alertmanagers',
                subresource: 'api',
                verb: 'create',
                name: 'main',
                namespace: 'openshift-monitoring',
              }
        }
        isDisabled={accessCheckLoading}
        description={t('Temporarily stop notifications for this alert.')}
        to={getCreateSilenceUrl(alert.labels)}
        onClick={(event) => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }
          event.preventDefault();
          navigateToSilence(alert.labels);
        }}
        data-test={DataTestIDs.SilenceAlertDropdownItem}
      >
        {t('Silence alert')}
      </AlertActionItem>,
      <Divider component="li" key="silence-separator" />,
    );
  }

  dropdownItems.push(
    <DropdownItem key="view-alert-rule" to={getAlertRuleDetailsUrl(alert.rule)}>
      {t('View alert rule')}
    </DropdownItem>,
    <DropdownItem
      key="view-metrics"
      isDisabled={!alert.rule.query}
      isAriaDisabled={!alert.rule.query}
      to={getQueryBrowserUrl({ perspective: 'admin', query: alert.rule.query })}
    >
      {t('View metrics')}
    </DropdownItem>,
  );

  if (run?.metadata?.name) {
    dropdownItems.push(
      <Divider component="li" key="separator" />,
      <DropdownItem
        key="view-ai-investigation"
        icon={<CustomIcon name="ai-experience" />}
        to={getAgenticRunUrl(run.metadata.namespace, run.metadata.name)}
        data-test={DataTestIDs.ViewAIInvestigationDropdownItem}
        description={
          <Content component={ContentVariants.small}>
            <Flex spaceItems={{ default: 'spaceItemsXs' }}>
              <FlexItem>
                <InfoCircleIcon color="var(--pf-t--global--icon--color--status--info--default)" />
              </FlexItem>
              <FlexItem>{t('Always review AI-generated content prior to use.')}</FlexItem>
            </Flex>
          </Content>
        }
      >
        {t('View AI Investigation')}
      </DropdownItem>,
    );
  } else if (isFetching) {
    dropdownItems.push(
      <DropdownItem
        key="loading-ai-investigation"
        icon={<CustomIcon name="ai-experience" />}
        isDisabled
      >
        <Spinner size="sm" /> {t('Loading investigations...')}
      </DropdownItem>,
    );
  }

  return (
    <ActionServiceProvider context={{ 'monitoring-alert-list-item': { alert } }}>
      {({ actions, loaded }) => (
        <div onFocus={prefetch}>
          <KebabDropdown
            ariaLabel={t('Actions for {{name}}', { name })}
            onMouseEnter={prefetch}
            dropdownItems={[
              ...dropdownItems,
              ...(loaded
                ? actions.flatMap((action) => {
                    if (typeof action.cta === 'object' && 'href' in action.cta) {
                      return [
                        <AlertActionItem
                          key={action.id}
                          accessReview={action.accessReview}
                          isDisabled={action.disabled}
                          to={action.cta.href}
                          isExternalLink={action.cta.external}
                        >
                          {action.label}
                        </AlertActionItem>,
                      ];
                    }
                    if (typeof action.cta === 'function') {
                      return [
                        <AlertActionItem
                          key={action.id}
                          accessReview={action.accessReview}
                          isDisabled={action.disabled}
                          onClick={action.cta}
                        >
                          {action.label}
                        </AlertActionItem>,
                      ];
                    }
                    return [];
                  })
                : []),
            ]}
          />
        </div>
      )}
    </ActionServiceProvider>
  );
}
