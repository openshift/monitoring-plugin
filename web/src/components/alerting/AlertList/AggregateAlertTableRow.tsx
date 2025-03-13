import { Alert, TableColumn, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getRuleUrl, usePerspective } from '../../../components/hooks/usePerspective';
import { AggregatedAlert } from '../AlertsAggregates';
import { AlertState, MonitoringResourceIcon, Severity } from '../AlertUtils';
import AlertTableRow from './AlertTableRow';
import { tableAggregatedAlertClasses } from './hooks/useAggregateAlertColumns';
import { RuleResource } from '../../../components/utils';
import { Link } from 'react-router-dom';
import { SelectedFilters } from '../useSelectedFilters';
import { filterAlerts } from './hooks/utils';
import { Badge } from '@patternfly/react-core';

type AggregateAlertTableRowProps = React.FC<{
  aggregatedAlert: AggregatedAlert;
  rowData: { rowIndex: number; selectedFilters: SelectedFilters };
}>;

const AggregateAlertTableRow: AggregateAlertTableRowProps = ({
  aggregatedAlert,
  rowData: { rowIndex, selectedFilters },
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const title = aggregatedAlert.name;
  const isACMPerspective = perspective === 'acm';
  const [namespace] = useActiveNamespace();

  const filteredAlerts = useMemo(
    () => filterAlerts(aggregatedAlert.alerts, selectedFilters),
    [aggregatedAlert.alerts, selectedFilters],
  );

  const columns: TableColumn<Alert>[] = [
    {
      title: t('Name'),
      id: 'alert-name',
    },
    {
      title: t('Severity'),
      id: 'alert-severity',
    },
    {
      title: t('Namespace'),
      id: 'alert-namespace',
      props: { className: 'pf-m-width-30' },
    },
    {
      title: t('State'),
      id: 'alert-state',
    },
    {
      title: t('Source'),
      id: 'alert-source',
    },
    ...(isACMPerspective
      ? [
          {
            title: t('Cluster'),
            id: 'alert-cluster',
          },
        ]
      : []),
    {
      title: '',
      id: 'actions',
    },
  ];

  const firstAlert = aggregatedAlert?.alerts?.[0];

  return (
    <Tbody key={title} isExpanded={isExpanded} role="rowgroup" className="aggregatedalert-row">
      <Tr>
        <Td
          expand={{
            rowIndex,
            isExpanded,
            onToggle: (event, rowIndex, isOpen) => setIsExpanded(isOpen),
            expandId: 'expand-interfaces-list',
          }}
        />
        <td className={tableAggregatedAlertClasses[0]} title={title}>
          <MonitoringResourceIcon resource={RuleResource} />
          <Link
            to={getRuleUrl(
              perspective,
              firstAlert?.rule,
              firstAlert?.labels?.namespace || namespace,
            )}
            data-test-id="alert-resource-link"
            className="co-resource-item__resource-name"
          >
            {aggregatedAlert.name}
          </Link>
        </td>
        <td className={tableAggregatedAlertClasses[1]} title={title}>
          <Severity severity={aggregatedAlert.severity} />
        </td>
        <td className={tableAggregatedAlertClasses[2]} title={title}>
          <Badge key={1} isRead>
            {filteredAlerts.length}
          </Badge>
        </td>
        <td className={tableAggregatedAlertClasses[3]} title={title}>
          {Array.from(aggregatedAlert.states).map((state) => (
            <AlertState state={state} key={state} />
          ))}
        </td>
      </Tr>
      <Tr isExpanded={isExpanded} className={`aggregatedalert-row__expanded-${isExpanded}`}>
        <Td colSpan={isACMPerspective ? 6 : 5}>
          <ExpandableRowContent>
            <Table>
              <Thead className="aggregatedalert-row__alert-table-head">
                <Tr>
                  {columns.map((column) => (
                    <Th key={column.id} {...column?.props}>
                      {column.title}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              {filteredAlerts.map((alert) => (
                <AlertTableRow alert={alert} key={alert.activeAt} />
              ))}
            </Table>
          </ExpandableRowContent>
        </Td>
      </Tr>
    </Tbody>
  );
};

export default AggregateAlertTableRow;
