import React from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

const IncidentsDetailsRowTable = ({ alerts }) => {
  return (
    <Table borders={'compactBorderless'}>
      <Thead>
        <Tr>
          <Th width={40}>Alert name</Th>
          <Th width={25}>Namespace</Th>
          <Th width={25}>Severity</Th>
          <Th width={25}>State</Th>
          <Th width={40}>Firing started</Th>
          <Th width={40}>Firing ended</Th>
        </Tr>
      </Thead>
      <Tbody>
        {alerts?.map((alertDetails, rowIndex) => (
          <Tr key={rowIndex}>
            <Td dataLabel="expanded-details-alertname">{alertDetails.alertname}</Td>
            <Td dataLabel="expanded-details-namespace">{alertDetails.namespace}</Td>
            <Td dataLabel="expanded-details-severity">{alertDetails.severity}</Td>
            <Td dataLabel="expanded-details-alertstate">{alertDetails.alertstate}</Td>
            <Td dataLabel="expanded-details-firingstart">{Date(alertDetails.alertsStartFiring)}</Td>
            <Td dataLabel="expanded-details-firingend">{Date(alertDetails.alertsEndFiring)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default IncidentsDetailsRowTable;
