import {
  Action,
  ActionServiceProvider,
  Alert,
  AlertStates,
  ResourceIcon,
  ResourceLink,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  alertSource,
  AlertState,
  AlertStateDescription,
  isActionWithCallback,
  isActionWithHref,
  NamespaceGroupVersionKind,
  SeverityBadge,
} from '../AlertUtils';
import { AlertSource } from '../../../components/types';
import { Td, Tr } from '@patternfly/react-table';
import { DropdownItem, Flex, FlexItem, Spinner } from '@patternfly/react-core';
import KebabDropdown from '../../../components/kebab-dropdown';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router';
import { AlertResource, alertState } from '../../../components/utils';
import {
  getAlertUrl,
  getNewSilenceAlertUrl,
  usePerspective,
} from '../../../components/hooks/usePerspective';
import { useMonitoringNamespace } from '../../hooks/useMonitoringNamespace';
import { DataTestIDs } from '../../data-test';
import { useProposalCheck } from '../../ai-proposals/useProposalCheck';
import CustomIcon from '../../CustomIcon';

const getProposalUrl = (namespace: string, name: string): string => {
  return `/lightspeed/proposals/${namespace}/${name}`;
};

const AlertTableRow: FC<{ alert: Alert }> = ({ alert }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const { namespace } = useMonitoringNamespace();

  const state = alertState(alert);
  const { proposals, hasProposal, prefetch, isFetching } = useProposalCheck(alert);

  const title: string = alert.annotations?.description || alert.annotations?.message;

  const dropdownItems = [];

  if (state !== AlertStates.Silenced) {
    dropdownItems.unshift(
      <DropdownItem
        key="silence-alert"
        onClick={() => navigate(getNewSilenceAlertUrl(perspective, alert, namespace))}
        data-test={DataTestIDs.SilenceAlertDropdownItem}
      >
        {t('Silence alert')}
      </DropdownItem>,
    );
  }

  if (hasProposal) {
    const proposal = proposals[0];
    const proposalName = proposal.metadata?.name;
    if (proposalName) {
      const proposalUrl = getProposalUrl(proposal.metadata.namespace, proposalName);
      dropdownItems.push(
        <DropdownItem
          key="view-ai-investigation"
          icon={<CustomIcon name="ai-experience" />}
          onClick={() => navigate(proposalUrl)}
          data-test={DataTestIDs.ViewAIInvestigationDropdownItem}
        >
          {t('View AI Investigation')}
        </DropdownItem>,
      );
    }
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

  const getDropdownItemsWithExtension = (actions: Action[]) => {
    const extensionDropdownItems = [];
    actions.forEach((action) => {
      if (isActionWithHref(action)) {
        extensionDropdownItems.push(
          <DropdownItem key={action.id} href={action.cta.href}>
            {action.label}
          </DropdownItem>,
        );
      } else if (isActionWithCallback(action)) {
        extensionDropdownItems.push(
          <DropdownItem key={action.id} onClick={action.cta}>
            {action.label}
          </DropdownItem>,
        );
      }
    });
    return dropdownItems.concat(extensionDropdownItems);
  };

  return (
    <Tr>
      <Td title={title}>
        <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
          <FlexItem data-test={DataTestIDs.AlertResourceIcon}>
            <ResourceIcon kind={AlertResource.kind} />
          </FlexItem>
          <FlexItem>
            <Link
              to={getAlertUrl(perspective, alert, alert?.rule?.id, namespace)}
              data-test-id="alert-resource-link"
              data-test={DataTestIDs.AlertResourceLink}
            >
              {alert?.labels?.alertname}
            </Link>
          </FlexItem>
        </Flex>
      </Td>
      <Td title={title} data-test={DataTestIDs.SeverityBadge}>
        <SeverityBadge severity={alert.labels?.severity} />
      </Td>
      <Td title={title} data-test={DataTestIDs.AlertNamespace}>
        {alert.labels?.namespace ? (
          <ResourceLink
            groupVersionKind={NamespaceGroupVersionKind}
            name={alert.labels?.namespace}
          />
        ) : (
          '-'
        )}
      </Td>
      <Td title={title} data-test={DataTestIDs.AlertState}>
        <AlertState state={state} />
        <AlertStateDescription alert={alert} />
      </Td>
      <Td title={title} data-test={DataTestIDs.AlertSource}>
        {alertSource(alert) === AlertSource.User ? t('User') : t('Platform')}
      </Td>
      {perspective === 'acm' && (
        <Td title={title} data-test={DataTestIDs.AlertCluster}>
          {alert.labels?.cluster}
        </Td>
      )}
      <Td title={title}>
        <ActionServiceProvider context={{ 'monitoring-alert-list-item': { alert: alert } }}>
          {({ actions, loaded }) => {
            const items =
              loaded && actions.length > 0 ? getDropdownItemsWithExtension(actions) : dropdownItems;
            return items?.length > 0 ? (
              <KebabDropdown dropdownItems={items} onMouseEnter={prefetch} />
            ) : null;
          }}
        </ActionServiceProvider>
      </Td>
    </Tr>
  );
};

export default AlertTableRow;
