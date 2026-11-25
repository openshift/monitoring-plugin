import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { Badge, Label } from '@patternfly/react-core';
import { Td, Tr } from '@patternfly/react-table';
import { useTranslation } from 'react-i18next';

import { AlertStateSummary } from '@/features/alert-management-api/components/table/AlertStateSummary';
import {
  ColumnCell,
  SortedColumnCells,
} from '@/features/alert-management-api/components/table/SortedColumnCells';
import {
  AlertName,
  AlertRow,
} from '@/features/alert-management-api/pages/alerts-page/alerts-table/AlertRow';
import type { StartColumnsConfiguration } from '@/features/alert-management-api/pages/alerts-page/alerts-table/row-types';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { AggregatedAlert } from '@/features/alert-management-api/types/types';
import { getFiringSinceTimestamp } from '@/features/alert-management-api/utils/alert-values';
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
};

export function AggregatedRow({
  aggregatedAlert,
  rowIndex,
  isExpanded,
  onToggle,
  startColumns,
  columns,
}: AggregatedRowProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const firingSince = getFiringSinceTimestamp(aggregatedAlert.alerts);

  const cells: ColumnCell<AlertColumn>[] = [
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
          <AlertStateSummary
            firingAlertCount={aggregatedAlert.firingAlertCount}
            pendingAlertCount={aggregatedAlert.pendingAlertCount}
            silencedAlertCount={aggregatedAlert.silencedAlertCount}
          />
        </Td>
      ),
    },
    {
      column: 'scope',
      component: (
        <Td>
          <Label color="grey">{t(aggregatedAlert.alertScope)}</Label>
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
        <SortedColumnCells columns={columns} cells={cells} />
        <Td />
      </Tr>
      {isExpanded &&
        aggregatedAlert.alerts.map((alert, index) => (
          <AlertRow
            key={`${alert.rule.id}-${alert.activeAt}-${index}`}
            alert={alert}
            hasExpandColumn
            isAggregateChild
            startColumns={startColumns}
            columns={columns}
          />
        ))}
    </>
  );
}
