import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { ResourceIcon, Timestamp, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { ALL_NAMESPACES_KEY, RuleResource } from '../utils';
import { useTranslation } from 'react-i18next';
import { getRuleUrl, usePerspective } from '../hooks/usePerspective';
import './incidents-styles.css';
import { SeverityBadge } from '../alerting/AlertUtils';
import { Alert, IncidentsDetailsAlert } from './model';
import { IncidentAlertStateIcon } from './IncidentAlertStateIcon';
import { useMemo } from 'react';
import { DataTestIDs } from '../data-test';

interface IncidentsDetailsRowTableProps {
  alerts: Alert[];
}

const IncidentsDetailsRowTable = ({ alerts }: IncidentsDetailsRowTableProps) => {
  const [, setNamespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const sortedAndMappedAlerts = useMemo(() => {
    if (alerts && alerts.length > 0) {
      return [...alerts]
        .sort((a: IncidentsDetailsAlert, b: IncidentsDetailsAlert) => {
          const aStart = a.firstTimestamp > 0 ? a.firstTimestamp : a.alertsStartFiring;
          const bStart = b.firstTimestamp > 0 ? b.firstTimestamp : b.alertsStartFiring;
          return aStart - bStart;
        })
        .map((alertDetails: IncidentsDetailsAlert, rowIndex) => {
          return (
            <Tr key={rowIndex}>
              <Td dataLabel="expanded-details-alertname">
                <ResourceIcon kind={RuleResource.kind} />
                <Link
                  to={getRuleUrl(perspective, alertDetails?.rule)}
                  onClick={() => setNamespace(ALL_NAMESPACES_KEY)}
                >
                  {alertDetails.alertname}
                </Link>
              </Td>
              <Td dataLabel="expanded-details-namespace">{alertDetails.namespace || '---'}</Td>
              <Td dataLabel="expanded-details-severity">
                <SeverityBadge severity={alertDetails.severity} />
              </Td>
              <Td dataLabel="expanded-details-firingstart">
                <Timestamp
                  timestamp={
                    (alertDetails.firstTimestamp > 0
                      ? alertDetails.firstTimestamp
                      : alertDetails.alertsStartFiring) * 1000
                  }
                />
              </Td>
              <Td dataLabel="expanded-details-firingend">
                {!alertDetails.resolved ? (
                  '---'
                ) : (
                  <Timestamp
                    timestamp={
                      (alertDetails.lastTimestamp > 0
                        ? alertDetails.lastTimestamp
                        : alertDetails.alertsEndFiring) * 1000
                    }
                  />
                )}
              </Td>
              <Td dataLabel="expanded-details-alertstate">
                <IncidentAlertStateIcon alertDetails={alertDetails} />
              </Td>
            </Tr>
          );
        });
    }

    return null;
  }, [alerts, perspective, setNamespace]);

  return (
    <Table borders={false} variant="compact" data-test={DataTestIDs.IncidentsDetailsTable.Table}>
      <Thead>
        <Tr>
          <Th width={25}>{t('Alert')}</Th>
          <Th>{t('Namespace')}</Th>
          <Th>{t('Severity')}</Th>
          <Th>{t('Start')}</Th>
          <Th>{t('End')}</Th>
          <Th>{t('State')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {!alerts ? (
          <Bullseye>
            <Spinner
              aria-label="incidents-chart-spinner"
              data-test={DataTestIDs.IncidentsDetailsTable.LoadingSpinner}
            />
          </Bullseye>
        ) : (
          sortedAndMappedAlerts
        )}
      </Tbody>
    </Table>
  );
};

export default IncidentsDetailsRowTable;
