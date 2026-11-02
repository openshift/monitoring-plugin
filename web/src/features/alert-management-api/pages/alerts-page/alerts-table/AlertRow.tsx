import { ResourceIcon, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { DropdownItem, Flex, FlexItem, Label } from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import { AlertSelectionCheckbox } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import {
  AlertColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/pages/alerts-page/alerts-table/SortedColumnCells';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { getAlertDetailsSearch } from '@/features/alert-management-api/pages/alerts-page/utils/alert-details';
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
  columns: AlertColumn[];
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

  const cells: AlertColumnCell[] = [
    {
      column: 'name',
      component: (
        <Td {...startColumns.nameColumn}>
          <AlertName name={name}>
            <Link to={{ pathname, search: getAlertDetailsSearch(search, alert), hash }}>
              {name}
            </Link>
          </AlertName>
        </Td>
      ),
    },
    {
      column: 'severity',
      component: (
        <Td>
          <SeverityBadge severity={alert.labels.severity} />
        </Td>
      ),
    },
    {
      column: 'total',
      component: (
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
      ),
    },
    {
      column: 'state',
      component: (
        <Td>
          <AlertState state={alert.state} />
          <AlertStateDescription alert={alert} />
        </Td>
      ),
    },
    {
      column: 'scope',
      component: (
        <Td>
          <Label color="grey">{alert.alertScope}</Label>
        </Td>
      ),
    },
    {
      column: 'component',
      component: (
        <Td>
          <Label variant="outline">{alert.component}</Label>
        </Td>
      ),
    },
    { column: 'source', component: <Td>{getSourceKey(startCase(alert.source), t)}</Td> },
    {
      column: 'description',
      component: <Td>{alert.annotations.description ?? alert.annotations.summary}</Td>,
    },
    {
      column: 'firingSince',
      component: (
        <Td>
          {isAggregateChild ? (
            <Timestamp timestamp={alert.activeAt} />
          ) : firingSince !== 0 ? (
            <Timestamp timestamp={new Date(firingSince).toISOString()} />
          ) : (
            '-'
          )}
        </Td>
      ),
    },
    { column: 'runbookUrl', component: <Td>{alert.annotations.runbook_url}</Td> },
    { column: 'namespace', component: <Td>{alert.labels.namespace ?? ''}</Td> },
    { column: 'resource', component: <Td>{alert.labels.resource ?? ''}</Td> },
  ];

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
      <SortedColumnCells columns={columns} cells={cells} />
      <Td hasAction>
        <AlertActions alert={alert} />
      </Td>
    </Tr>
  );
}
