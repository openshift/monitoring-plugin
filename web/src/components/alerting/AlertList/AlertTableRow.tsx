import {
  Action,
  ActionServiceProvider,
  Alert,
  AlertStates,
  ResourceLink,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  alertSource,
  AlertState,
  AlertStateDescription,
  isActionWithCallback,
  isActionWithHref,
  MonitoringResourceIcon,
  NamespaceGroupVersionKind,
  Severity,
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
import { Link } from 'react-router-dom';

const tableAlertClasses = [
  'pf-v5-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Severity
  '', // Namespace
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Source
  'pf-m-hidden pf-m-visible-on-sm', // Cluster
  'dropdown-kebab-pf pf-v5-c-table__action',
];

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
      <Td className={tableAlertClasses[0]} title={title}>
        <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
          <FlexItem>
            <MonitoringResourceIcon resource={AlertResource} />
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
              {alert?.labels?.alertname}
            </Link>
          </FlexItem>
        </Flex>
      </Td>
      <Td className={tableAlertClasses[1]} title={title}>
        <Severity severity={alert.labels?.severity} />
      </Td>
      <Td className={tableAlertClasses[2]} title={title}>
        {alert.labels?.namespace ? (
          <ResourceLink
            groupVersionKind={NamespaceGroupVersionKind}
            name={alert.labels?.namespace}
          />
        ) : (
          '-'
        )}
      </Td>
      <Td className={tableAlertClasses[3]} title={title}>
        <AlertState state={state} />
        <AlertStateDescription alert={alert} />
      </Td>
      <Td className={tableAlertClasses[4]} title={title}>
        {alertSource(alert) === AlertSource.User ? t('User') : t('Platform')}
      </Td>
      {perspective === 'acm' && (
        <Td className={tableAlertClasses[5]} title={title}>
          {alert.labels?.cluster}
        </Td>
      )}
      <Td className={tableAlertClasses[6]} title={title}>
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
