import { AlertSeverity, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  Bullseye,
  Card,
  CardBody,
  EmptyState,
  EmptyStateBody,
  Button,
} from '@patternfly/react-core';
import { SearchIcon, AngleDownIcon, AngleRightIcon } from '@patternfly/react-icons';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { isEmpty } from 'lodash-es';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { MonitoringState } from '../../store/store';
import { SeverityBadge } from '../alerting/AlertUtils';
import IncidentsDetailsRowTable from './IncidentsDetailsRowTable';
import { GroupedAlertStateIcon } from './IncidentAlertStateIcon';

import { GroupedAlert } from './model';
import { DataTestIDs } from '../data-test';

export const IncidentsTable = () => {
  const columnNames = {
    checkbox: '',
    component: 'Component',
    severity: 'Severity',
    state: 'State',
    startDate: 'Start',
  };
  const alertsTableData = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData?.alertsTableData,
  );
  const alertsAreLoading = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.alertsAreLoading,
  );
  const incidentsActiveFilters = useSelector(
    (state: MonitoringState) => state.plugins.mcp.incidentsData.incidentsActiveFilters,
  );

  const [expandedAlerts, setExpandedAlerts] = useState<Array<string>>([]);
  const setAlertExpanded = (alert: GroupedAlert, isExpanding = true) =>
    setExpandedAlerts((prevExpanded) => {
      const otherAlertExpanded = prevExpanded.filter((r) => r !== alert.component);
      return isExpanding ? [...otherAlertExpanded, alert.component] : otherAlertExpanded;
    });
  const isAlertExpanded = (alert: GroupedAlert) => expandedAlerts.includes(alert.component);
  const [previousAlertDataLength, setPreviousAlertDataLength] = useState(0);

  useEffect(() => {
    if (alertsTableData && !alertsAreLoading) {
      const currentLength = alertsTableData.length;
      if (currentLength !== previousAlertDataLength) {
        setExpandedAlerts([]);
        setPreviousAlertDataLength(currentLength);
      }
    }
  }, [alertsTableData, alertsAreLoading, previousAlertDataLength]);

  const expandAllRows = () => {
    if (alertsTableData) {
      const allComponents = alertsTableData
        .filter((alert: GroupedAlert) => alert.alertsExpandedRowData)
        .map((alert: GroupedAlert) => alert.component);
      setExpandedAlerts(allComponents);
    }
  };

  const collapseAllRows = () => {
    setExpandedAlerts([]);
  };

  const areAllRowsExpanded = () => {
    if (!alertsTableData) return false;
    const expandableComponents = alertsTableData
      .filter((alert: GroupedAlert) => alert.alertsExpandedRowData)
      .map((alert: GroupedAlert) => alert.component);
    return (
      expandableComponents.length > 0 &&
      expandableComponents.every((component: string) => expandedAlerts.includes(component))
    );
  };

  const toggleAllRows = () => {
    if (areAllRowsExpanded()) {
      collapseAllRows();
    } else {
      expandAllRows();
    }
  };

  const getMinStartDate = (alert: GroupedAlert): number => {
    if (!alert.alertsExpandedRowData || alert.alertsExpandedRowData.length === 0) {
      return 0;
    }
    return Math.min(...alert.alertsExpandedRowData.map((alertData) => alertData.alertsStartFiring));
  };

  if (isEmpty(alertsTableData) || alertsAreLoading || isEmpty(incidentsActiveFilters.groupId)) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            style={{
              height: '150px',
            }}
            icon={SearchIcon}
          >
            <EmptyStateBody>
              <Bullseye>No incident selected.</Bullseye>
            </EmptyStateBody>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardBody>
        <Table aria-label="alerts-table" isExpandable data-test={DataTestIDs.IncidentsTable.Table}>
          <Thead>
            <Tr>
              <Th width={10}>
                <Button
                  variant="plain"
                  onClick={toggleAllRows}
                  aria-label={areAllRowsExpanded() ? 'Collapse all rows' : 'Expand all rows'}
                  isDisabled={!alertsTableData || alertsTableData.length === 0}
                  style={{ padding: '0.25rem' }}
                >
                  {areAllRowsExpanded() ? <AngleDownIcon /> : <AngleRightIcon />}
                </Button>
              </Th>
              <Th width={30}>{columnNames.component}</Th>
              <Th>{columnNames.severity}</Th>
              <Th>{columnNames.startDate}</Th>
              <Th>{columnNames.state}</Th>
            </Tr>
          </Thead>
          {[...alertsTableData]
            .sort((a: GroupedAlert, b: GroupedAlert) => getMinStartDate(a) - getMinStartDate(b))
            .map((alert: GroupedAlert, rowIndex: number) => {
              return (
                <Tbody
                  key={rowIndex}
                  isExpanded={isAlertExpanded(alert)}
                  data-test={`${DataTestIDs.IncidentsTable.Row}-${rowIndex}`}
                >
                  <Tr>
                    <Td
                      expand={
                        alert.alertsExpandedRowData
                          ? {
                              rowIndex,
                              isExpanded: isAlertExpanded(alert),
                              onToggle: () => setAlertExpanded(alert, !isAlertExpanded(alert)),
                              expandId: 'alert-expandable',
                            }
                          : undefined
                      }
                      data-test={`${DataTestIDs.IncidentsTable.ExpandButton}-${rowIndex}`}
                    />
                    <Td
                      dataLabel={columnNames.component}
                      data-test={`${DataTestIDs.IncidentsTable.ComponentCell}-${rowIndex}`}
                    >
                      {alert.component}
                    </Td>
                    <Td data-test={`${DataTestIDs.IncidentsTable.SeverityCell}-${rowIndex}`}>
                      {alert.critical > 0 && (
                        <SeverityBadge severity={AlertSeverity.Critical} count={alert.critical} />
                      )}
                      {alert.warning > 0 && (
                        <SeverityBadge severity={AlertSeverity.Warning} count={alert.warning} />
                      )}
                      {alert.info > 0 && (
                        <SeverityBadge severity={AlertSeverity.Info} count={alert.info} />
                      )}
                    </Td>
                    <Td dataLabel={columnNames.startDate}>
                      <Timestamp timestamp={getMinStartDate(alert)} />
                    </Td>
                    <Td
                      dataLabel={columnNames.state}
                      data-test={`${DataTestIDs.IncidentsTable.StateCell}-${rowIndex}`}
                    >
                      <GroupedAlertStateIcon groupedAlert={alert} />
                    </Td>
                  </Tr>
                  {alert.alertsExpandedRowData && (
                    <Tr isExpanded={isAlertExpanded(alert)}>
                      <Td width={100} colSpan={5}>
                        <ExpandableRowContent>
                          <IncidentsDetailsRowTable alerts={alert.alertsExpandedRowData} />
                        </ExpandableRowContent>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              );
            })}
        </Table>
      </CardBody>
    </Card>
  );
};
