import { ResourceIcon, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { DropdownItem, Flex, FlexItem, Label } from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { AlertSelectionCheckbox } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import type { OptionalAlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { ManagedAlert } from '@/features/alert-management-api/types/types';
import { getFiringSinceTimestamp } from '@/features/alert-management-api/utils/alert-values';
import { AlertState, AlertStateDescription } from '@/shared/components/AlertState';
import KebabDropdown from '@/shared/components/KebabDropdown';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { DataTestIDs } from '@/shared/constants/data-test';
import { getSourceKey } from '@/shared/utils/alerts/alert-source';
import { startCase } from '@/shared/utils/strings';
import { AlertResource } from '@/shared/utils/utils';

const alertActions = [
  'Silence alert',
  'Acknowledge',
  'View alert rule',
  'View logs',
  'View metrics',
  'See related incident',
  'Troubleshoot with Signal Correlation',
  'Investigate with AI',
];

export function AlertName({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <Flex
      alignItems={{ default: 'alignItemsCenter' }}
      flexWrap={{ default: 'nowrap' }}
      spaceItems={{ default: 'spaceItemsSm' }}
    >
      <FlexItem data-test={DataTestIDs.AlertResourceIcon}>
        <ResourceIcon kind={AlertResource.kind} />
      </FlexItem>
      <FlexItem>{children ?? name}</FlexItem>
    </Flex>
  );
}

export function AlertActions({ alert }: { alert: ManagedAlert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const name = alert.labels.alertname ?? alert.rule.name;
  const namespace = alert.labels.namespace ?? '';

  return (
    <KebabDropdown
      ariaLabel={t('Actions for {{name}}', { name })}
      dropdownItems={alertActions.map((action) => (
        <DropdownItem
          key={action}
          // eslint-disable-next-line no-console
          onClick={() => console.debug(`${action}: ${name}, namespace: ${namespace}`)}
        >
          {t(action)}
        </DropdownItem>
      ))}
    />
  );
}

type AlertRowProps = {
  alert: ManagedAlert;
  rowIndex: number;
  alertIndex?: number;
  hasExpandColumn: boolean;
  isAggregateChild?: boolean;
  startColumns: StartColumnsConfiguration;
  columns: Set<OptionalAlertColumn>;
  selection: AlertSelection;
};

export function AlertRow({
  alert,
  rowIndex,
  alertIndex = 0,
  hasExpandColumn,
  isAggregateChild = false,
  startColumns,
  columns,
  selection,
}: AlertRowProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { pathname, search, hash } = useLocation();
  const name = alert.labels.alertname ?? alert.rule.name;
  const firingSince = getFiringSinceTimestamp([alert]);

  return (
    <Tr>
      {hasExpandColumn && <Td {...startColumns.expandColumn} />}
      <Td modifier="fitContent" {...startColumns.selectionColumn}>
        <AlertSelectionCheckbox
          alerts={[alert]}
          label={
            isAggregateChild
              ? t('Select {{name}} alert in namespace {{namespace}}', {
                  name,
                  namespace: alert.labels.namespace ?? '',
                })
              : t('Select {{name}} alerts', { name })
          }
          id={
            DataTestIDs.AlertManagementAPI.SelectionCheckboxPrefix +
            '-' +
            (isAggregateChild ? `alert-${rowIndex}-${alertIndex}` : `group-${rowIndex}`)
          }
          {...selection}
        />
      </Td>
      <Td {...startColumns.nameColumn}>
        <AlertName name={name}>
          {isAggregateChild ? (
            <Link
              to={{ pathname, search, hash }}
              onClick={() =>
                // eslint-disable-next-line no-console
                console.debug(`${name}, namespace: ${alert.labels.namespace ?? ''}`)
              }
            >
              {name}
            </Link>
          ) : undefined}
        </AlertName>
      </Td>
      <Td>
        <SeverityBadge severity={alert.labels.severity} />
      </Td>
      {isAggregateChild && columns.has('total') && (
        <Td>
          <span
            style={{
              display: 'inline-block',
              minWidth: 'var(--pf-t--global--spacer--xl)',
              textAlign: 'center',
            }}
          >
            1
          </span>
        </Td>
      )}
      {columns.has('state') && (
        <Td>
          <AlertState state={alert.state} />
          <AlertStateDescription alert={alert} />
        </Td>
      )}
      {columns.has('scope') && (
        <Td>
          <Label color="grey">{alert.alertScope}</Label>
        </Td>
      )}
      {columns.has('component') && (
        <Td>
          <Label variant="outline">{alert.component}</Label>
        </Td>
      )}
      {columns.has('source') && <Td>{getSourceKey(startCase(alert.source), t)}</Td>}
      {columns.has('description') && (
        <Td>{alert.annotations.description ?? alert.annotations.summary}</Td>
      )}
      {columns.has('firingSince') && (
        <Td>
          {isAggregateChild ? (
            <Timestamp timestamp={alert.activeAt} />
          ) : firingSince !== 0 ? (
            <Timestamp timestamp={new Date(firingSince).toISOString()} />
          ) : (
            '-'
          )}
        </Td>
      )}
      {columns.has('runbookUrl') && <Td>{alert.annotations.runbook_url}</Td>}
      {columns.has('namespace') && <Td>{alert.labels.namespace ?? ''}</Td>}
      {columns.has('resource') && <Td>{alert.labels.resource ?? ''}</Td>}
      <Td hasAction>
        <AlertActions alert={alert} />
      </Td>
    </Tr>
  );
}
