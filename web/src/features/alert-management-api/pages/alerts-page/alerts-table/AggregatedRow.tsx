import { AlertStates, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { Badge, Label } from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlertName,
  AlertRow,
} from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertRow';
import { AlertSelectionCheckbox } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { AlertSelection } from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertSelectionCheckbox';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import {
  AlertColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/pages/alerts-page/alerts-table/SortedColumnCells';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { getFiringSinceTimestamp } from '@/features/alert-management-api/utils/alert-values';
import { AlertState } from '@/shared/components/AlertState';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { DataTestIDs } from '@/shared/constants/data-test';
import { getSourceKey } from '@/shared/utils/alerts/alert-source';
import { startCase } from '@/shared/utils/strings';

type AggregatedRowProps = {
  aggregatedAlert: AggregatedAlert;
  rowIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
  startColumns: StartColumnsConfiguration;
  columns: AlertColumn[];
  selection: AlertSelection;
};

export function AggregatedRow({
  aggregatedAlert,
  rowIndex,
  isExpanded,
  onToggle,
  startColumns,
  columns,
  selection,
}: AggregatedRowProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const firingSince = getFiringSinceTimestamp(aggregatedAlert.alerts);

  const cells: AlertColumnCell[] = [
    {
      column: 'name',
      component: (
        <Td {...startColumns.nameColumn}>
          <AlertName name={aggregatedAlert.name} />
        </Td>
      ),
    },
    {
      column: 'severity',
      component: (
        <Td>
          <SeverityBadge severity={aggregatedAlert.severity} />
        </Td>
      ),
    },
    {
      column: 'total',
      component: (
        <Td>
          <Badge>{aggregatedAlert.alerts.length}</Badge>
        </Td>
      ),
    },
    {
      column: 'state',
      component: (
        <Td>
          {aggregatedAlert.state.map((state, index) => (
            <Fragment key={state}>
              {index > 0 && ', '}
              <AlertState state={state as AlertStates} />
            </Fragment>
          ))}
        </Td>
      ),
    },
    {
      column: 'scope',
      component: (
        <Td>
          <Label color="grey">{aggregatedAlert.alertScope}</Label>
        </Td>
      ),
    },
    {
      column: 'component',
      component: (
        <Td>
          <Label variant="outline">{aggregatedAlert.component}</Label>
        </Td>
      ),
    },
    { column: 'source', component: <Td>{getSourceKey(startCase(aggregatedAlert.source), t)}</Td> },
    {
      column: 'description',
      component: (
        <Td>
          {aggregatedAlert.alerts[0]?.annotations.description ??
            aggregatedAlert.alerts[0]?.annotations.summary}
        </Td>
      ),
    },
    {
      column: 'firingSince',
      component: (
        <Td>
          {firingSince !== 0 ? <Timestamp timestamp={new Date(firingSince).toISOString()} /> : '-'}
        </Td>
      ),
    },
    {
      column: 'runbookUrl',
      component: <Td>{aggregatedAlert.alerts[0]?.annotations.runbook_url}</Td>,
    },
    { column: 'namespace', component: <Td /> },
    { column: 'resource', component: <Td /> },
  ];

  return (
    <>
      <Tr>
        <Td
          expand={{
            rowIndex,
            isExpanded,
            onToggle,
            expandId: `${DataTestIDs.AlertManagementAPI.ExpandRowPrefix}-${rowIndex}`,
          }}
          {...startColumns.expandColumn}
        />
        <Td modifier="fitContent" {...startColumns.selectionColumn}>
          <AlertSelectionCheckbox
            alerts={aggregatedAlert.alerts}
            label={t('Select {{name}} alerts', { name: aggregatedAlert.name })}
            id={`${DataTestIDs.AlertManagementAPI.SelectionCheckboxPrefix}-group-${rowIndex}`}
            {...selection}
          />
        </Td>
        <SortedColumnCells columns={columns} cells={cells} />
        <Td />
      </Tr>
      {isExpanded &&
        aggregatedAlert.alerts.map((alert, index) => (
          <AlertRow
            key={`${alert.rule.id}-${alert.activeAt}-${index}`}
            alert={alert}
            rowIndex={rowIndex}
            alertIndex={index}
            hasExpandColumn
            isAggregateChild
            startColumns={startColumns}
            columns={columns}
            selection={selection}
          />
        ))}
    </>
  );
}
