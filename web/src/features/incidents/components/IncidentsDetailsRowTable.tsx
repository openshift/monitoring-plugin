import { ResourceIcon, Timestamp, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { IncidentAlertStateIcon } from '@/features/incidents/components/IncidentAlertStateIcon';
import { Alert, IncidentsDetailsAlert } from '@/features/incidents/types/model';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { DataTestIDs } from '@/shared/constants/data-test';
import { getRuleUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { ALL_NAMESPACES_KEY, RuleResource } from '@/shared/utils/utils';

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
        .sort(
          (a: IncidentsDetailsAlert, b: IncidentsDetailsAlert) =>
            a.alertsStartFiring - b.alertsStartFiring,
        )
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
                {alertDetails.alertsStartFiring ? (
                  <Timestamp
                    timestamp={new Date(alertDetails.alertsStartFiring * 1000).toISOString()}
                  />
                ) : (
                  '---'
                )}
              </Td>
              <Td dataLabel="expanded-details-firingend">
                {!alertDetails.resolved || !alertDetails.alertsEndFiring ? (
                  '---'
                ) : (
                  <Timestamp
                    timestamp={new Date(alertDetails.alertsEndFiring * 1000).toISOString()}
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
