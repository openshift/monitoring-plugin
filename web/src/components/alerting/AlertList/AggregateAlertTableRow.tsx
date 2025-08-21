import {
  Alert,
  ResourceIcon,
  TableColumn,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { FC } from 'react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getRuleUrl, usePerspective } from '../../../components/hooks/usePerspective';
import { AggregatedAlert } from '../AlertsAggregates';
import { AlertState, SeverityBadge } from '../AlertUtils';
import AlertTableRow from './AlertTableRow';
import { RuleResource } from '../../../components/utils';
import { Link } from 'react-router-dom-v5-compat';
import { SelectedFilters } from '../useSelectedFilters';
import { filterAlerts } from './hooks/utils';
import { Badge, Flex, FlexItem } from '@patternfly/react-core';
import { DataTestIDs } from '../../data-test';

type AggregateAlertTableRowProps = FC<{
  aggregatedAlert: AggregatedAlert;
  rowData: { rowIndex: number; selectedFilters: SelectedFilters };
}>;

const AggregateAlertTableRow: AggregateAlertTableRowProps = ({
  aggregatedAlert,
  rowData: { rowIndex, selectedFilters },
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const title = aggregatedAlert.name;
  const isACMPerspective = perspective === 'acm';
  const [namespace] = useActiveNamespace();

  const filteredAlerts = useMemo(
    () => filterAlerts(aggregatedAlert.alerts, selectedFilters),
    [aggregatedAlert.alerts, selectedFilters],
  );

  const filteredStates = Array.from(new Set(filteredAlerts.map((alert) => alert.state)));

  const columns: Array<TableColumn<Alert>> = [
    {
      title: t('Name'),
      id: 'alert-name',
      props: { width: 40 },
    },
    {
      title: t('Severity'),
      id: 'alert-severity',
    },
    {
      title: t('Namespace'),
      id: 'alert-namespace',
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
    <Tbody key={title} isExpanded={isExpanded} role="rowgroup">
      <Tr>
        <Td
          expand={{
            rowIndex,
            isExpanded,
            onToggle: (event, rowIndex, isOpen) => setIsExpanded(isOpen),
            expandId: 'expand-interfaces-list',
          }}
          data-test={DataTestIDs.AlertingRuleArrow}
        />
        <Td title={title}>
          <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
            <FlexItem data-test={DataTestIDs.AlertingRuleResourceIcon}>
              <ResourceIcon kind={RuleResource.kind} />
            </FlexItem>
            <FlexItem>
              <Link
                to={getRuleUrl(
                  perspective,
                  firstAlert?.rule,
                  firstAlert?.labels?.namespace || namespace,
                )}
                data-test-id="alert-resource-link"
                data-test={DataTestIDs.AlertingRuleResourceLink}
              >
                {aggregatedAlert.name}
              </Link>
            </FlexItem>
          </Flex>
        </Td>
        <Td title={title} data-test={DataTestIDs.AlertingRuleSeverityBadge}>
          <SeverityBadge severity={aggregatedAlert.severity} />
        </Td>
        <Td title={title} data-test={DataTestIDs.AlertingRuleTotalAlertsBadge}>
          <Badge key={1} isRead>
            {filteredAlerts.length}
          </Badge>
        </Td>
        <Td title={title} data-test={DataTestIDs.AlertingRuleStateBadge}>
          {filteredStates.map((state) => (
            <AlertState state={state} key={state} />
          ))}
        </Td>
      </Tr>
      <Tr isExpanded={isExpanded}>
        <Td colSpan={isACMPerspective ? 6 : 5}>
          <ExpandableRowContent>
            <Table>
              <Thead>
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
