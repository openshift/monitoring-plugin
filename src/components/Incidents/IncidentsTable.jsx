import React from 'react';
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from '@patternfly/react-table';
import { Bullseye, Card, CardBody, Checkbox, Label, Spinner } from '@patternfly/react-core';
import InfoCircleIcon from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { AlertStateIcon } from '../alerting/AlertUtils';
import IncidentsDetailsRowTable from './IncidentsDetailsRowTable';

export const IncidentsTable = ({ loaded, data = [] }) => {
  const columnNames = {
    checkbox: '',
    component: 'Component',
    severity: 'Severity',
    state: 'State',
  };
  const [expandedAlerts, setExpandedAlerts] = React.useState([]);
  const setAlertExpanded = (alert, isExpanding = true) =>
    setExpandedAlerts((prevExpanded) => {
      const otherAlertExpanded = prevExpanded.filter((r) => r !== alert.component);
      return isExpanding ? [...otherAlertExpanded, alert.component] : otherAlertExpanded;
    });
  const isAlertExpanded = (alert) => expandedAlerts.includes(alert.component);

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
          {!loaded ? (
            <Bullseye>
              <Spinner aria-label="incidents-chart-spinner" />
            </Bullseye>
          ) : (
            data.map((alert, rowIndex) => {
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
                      {alert.critical > 0 ? (
                        <Label color="red" icon={<InfoCircleIcon />}>
                          {alert.critical}
                        </Label>
                      ) : (
                        ''
                      )}
                      {alert.warning > 0 ? (
                        <Label color="gold" icon={<InfoCircleIcon />}>
                          {alert.warning}
                        </Label>
                      ) : (
                        ''
                      )}
                      {alert.info > 0 ? (
                        <Label color="blue" icon={<InfoCircleIcon />}>
                          {alert.info}
                        </Label>
                      ) : (
                        ''
                      )}
                    </Td>
                    <Td dataLabel={columnNames.state}>
                      <AlertStateIcon state={alert.alertstate} />
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
            })
          )}
        </Table>
      </CardBody>
    </Card>
  );
};
