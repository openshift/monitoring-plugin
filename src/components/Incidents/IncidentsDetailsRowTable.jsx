import React from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { GreenCheckCircleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon, ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { Icon } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { AlertResource } from '../utils';
import { MonitoringResourceIcon } from '../alerting/AlertUtils';
import { formatDateInExpandedDetails } from './utils';

const IncidentsDetailsRowTable = ({ alerts }) => {
  return (
    <Table borders={'compactBorderless'}>
      <Thead>
        <Tr>
          <Th width={25}>Alert name</Th>
          <Th width={15}>Namespace</Th>
          <Th width={10}>Severity</Th>
          <Th width={10}>State</Th>
          <Th width={20}>Firing started</Th>
          <Th width={20}>Firing ended</Th>
        </Tr>
      </Thead>
      <Tbody>
        {alerts?.map((alertDetails, rowIndex) => (
          <Tr key={rowIndex}>
            <Td dataLabel="expanded-details-alertname">
              <MonitoringResourceIcon resource={AlertResource} />
              <Link
                // eslint-disable-next-line max-len
                to={`/monitoring/alerts/4033586302?namespace=${alertDetails.namespace}&prometheus=${alertDetails.namespace}&severity=${alertDetails.severity}&alertname=${alertDetails.alertname}`}
              >
                {alertDetails.alertname}
              </Link>
            </Td>
            <Td dataLabel="expanded-details-namespace">{alertDetails.namespace}</Td>
            <Td dataLabel="expanded-details-severity">
              {alertDetails.severity === 'critical' ? (
                <>
                  <Icon status="danger">
                    <ExclamationCircleIcon />
                  </Icon>
                  Critical
                </>
              ) : alertDetails.severity === 'warning' ? (
                <>
                  <Icon status="warning">
                    <ExclamationTriangleIcon />
                  </Icon>
                  Warning
                </>
              ) : (
                <>
                  <Icon status="info">
                    <InfoCircleIcon />
                  </Icon>
                  Info
                </>
              )}
            </Td>
            <Td dataLabel="expanded-details-alertstate">
              {alertDetails.alertstate === 'firing' ? (
                <>
                  <BellIcon />
                  Firing
                </>
              ) : (
                <>
                  <GreenCheckCircleIcon />
                  Resolved
                </>
              )}
            </Td>
            <Td dataLabel="expanded-details-firingstart">
              {formatDateInExpandedDetails(alertDetails.alertsStartFiring)}
            </Td>
            <Td dataLabel="expanded-details-firingend">
              {formatDateInExpandedDetails(alertDetails.alertsEndFiring)}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default IncidentsDetailsRowTable;
