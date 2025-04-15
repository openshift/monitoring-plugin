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
import { DropdownItem, Flex, FlexItem } from '@patternfly/react-core';
import KebabDropdown from '../../../components/kebab-dropdown';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useRouteMatch } from 'react-router';
import { AlertResource, alertState } from '../../../components/utils';
import {
  getAlertUrl,
  getNewSilenceAlertUrl,
  usePerspective,
} from '../../../components/hooks/usePerspective';
import { Link } from 'react-router-dom-v5-compat';

const AlertTableRow: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const history = useHistory();
  const match = useRouteMatch<{ ns: string }>();

  const namespace = match.params.ns;

  const state = alertState(alert);

  const title: string = alert.annotations?.description || alert.annotations?.message;

  const dropdownItems = [];

  if (state !== AlertStates.Silenced) {
    dropdownItems.unshift(
      <DropdownItem
        key="silence-alert"
        onClick={() => history.push(getNewSilenceAlertUrl(perspective, alert, namespace))}
      >
        {t('Silence alert')}
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
          <FlexItem>
            <ResourceIcon kind={AlertResource.kind} />
          </FlexItem>
          <FlexItem>
            <Link
              to={getAlertUrl(
                perspective,
                alert,
                alert?.rule?.id,
                alert?.labels?.namespace || namespace,
              )}
              data-test-id="alert-resource-link"
            >
              {alert?.labels?.alertname} TACOS
            </Link>
          </FlexItem>
        </Flex>
      </Td>
      <Td title={title}>
        <SeverityBadge severity={alert.labels?.severity} />
      </Td>
      <Td title={title}>
        {alert.labels?.namespace ? (
          <ResourceLink
            groupVersionKind={NamespaceGroupVersionKind}
            name={alert.labels?.namespace}
          />
        ) : (
          '-'
        )}
      </Td>
      <Td title={title}>
        <AlertState state={state} />
        <AlertStateDescription alert={alert} />
      </Td>
      <Td title={title}>{alertSource(alert) === AlertSource.User ? t('User') : t('Platform')}</Td>
      {perspective === 'acm' && <Td title={title}>{alert.labels?.cluster}</Td>}
      <Td title={title}>
        <ActionServiceProvider context={{ 'monitoring-alert-list-item': { alert: alert } }}>
          {({ actions, loaded }) => {
            if (loaded && actions.length > 0) {
              return <KebabDropdown dropdownItems={getDropdownItemsWithExtension(actions)} />;
            } else {
              return dropdownItems?.length > 0 ? (
                <KebabDropdown dropdownItems={dropdownItems} />
              ) : null;
            }
          }}
        </ActionServiceProvider>
      </Td>
    </Tr>
  );
};

export default AlertTableRow;
