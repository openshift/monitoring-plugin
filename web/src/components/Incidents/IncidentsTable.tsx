import { AlertSeverity, AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Card, CardBody, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { MonitoringState } from 'src/reducers/observe';
import { AlertStateIcon, SeverityBadge } from '../alerting/AlertUtils';
import IncidentsDetailsRowTable from './IncidentsDetailsRowTable';
import { Alert } from './model';

export const IncidentsTable = () => {
  const columnNames = {
    checkbox: '',
    component: 'Component',
    severity: 'Severity',
    state: 'State',
  };
  const [expandedAlerts, setExpandedAlerts] = useState([]);
  const setAlertExpanded = (alert: Alert, isExpanding = true) =>
    setExpandedAlerts((prevExpanded) => {
      const otherAlertExpanded = prevExpanded.filter((r) => r !== alert.component);
      return isExpanding ? [...otherAlertExpanded, alert.component] : otherAlertExpanded;
    });
  const isAlertExpanded = (alert: Alert) => expandedAlerts.includes(alert.component);
  const alertsTableData = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsTableData']),
  );
  const alertsAreLoading = useSelector((state: MonitoringState) =>
    state.plugins.mcp.getIn(['incidentsData', 'alertsAreLoading']),
  );

  if (_.isEmpty(alertsTableData) || alertsAreLoading) {
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
              <Bullseye>No incidents selected.</Bullseye>
            </EmptyStateBody>
          </EmptyState>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <Table aria-label="alerts-table" isExpandable>
          <Thead>
            <Tr>
              <Th screenReaderText="Row expansion" />
              <Th width={50}>{columnNames.component}</Th>
              <Th width={25}>{columnNames.severity}</Th>
              <Th width={25}>{columnNames.state}</Th>
            </Tr>
          </Thead>
          {alertsTableData.map((alert, rowIndex) => {
            return (
              <Tbody key={rowIndex} isExpanded={isAlertExpanded(alert)}>
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
                  />
                  <Td dataLabel={columnNames.component}>{alert.component}</Td>
                  <Td>
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
                  <Td dataLabel={columnNames.state}>
                    <AlertStateIcon
                      state={
                        alert.alertstate === 'resolved' ? AlertStates.Silenced : AlertStates.Firing
                      }
                    />
                  </Td>
                </Tr>
                {alert.alertsExpandedRowData && (
                  <Tr isExpanded={isAlertExpanded(alert)}>
                    <Td width={100} colSpan={6}>
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
