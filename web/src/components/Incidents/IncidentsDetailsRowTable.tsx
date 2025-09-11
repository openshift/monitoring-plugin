import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { ResourceIcon, Timestamp, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { RuleResource } from '../utils';
import { useTranslation } from 'react-i18next';
import { getRuleUrl, usePerspective } from '../hooks/usePerspective';
import './incidents-styles.css';
import { SeverityBadge } from '../alerting/AlertUtils';
import { Alert, IncidentsDetailsAlert } from './model';
import { IncidentAlertStateIcon } from './IncidentAlertStateIcon';

interface IncidentsDetailsRowTableProps {
  alerts: Alert[];
}

const IncidentsDetailsRowTable = ({ alerts }: IncidentsDetailsRowTableProps) => {
  const [namespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Table borders={false} variant="compact">
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
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          alerts
            ?.sort(
              (a: IncidentsDetailsAlert, b: IncidentsDetailsAlert) =>
                a.alertsStartFiring - b.alertsStartFiring,
            )
            ?.map((alertDetails: IncidentsDetailsAlert, rowIndex: number) => {
              return (
                <Tr key={rowIndex}>
                  <Td dataLabel="expanded-details-alertname">
                    <ResourceIcon kind={RuleResource.kind} />
                    <Link to={getRuleUrl(perspective, alertDetails?.rule, namespace)}>
                      {alertDetails.alertname}
                    </Link>
                  </Td>
                  <Td dataLabel="expanded-details-namespace">{alertDetails.namespace || '---'}</Td>
                  <Td dataLabel="expanded-details-severity">
                    <SeverityBadge severity={alertDetails.severity} />
                  </Td>
                  <Td dataLabel="expanded-details-firingstart">
                    <Timestamp timestamp={alertDetails.alertsStartFiring} />
                  </Td>
                  <Td dataLabel="expanded-details-firingend">
                    {!alertDetails.resolved ? (
                      '---'
                    ) : (
                      <Timestamp timestamp={alertDetails.alertsEndFiring} />
                    )}
                  </Td>
                  <Td dataLabel="expanded-details-alertstate">
                    <IncidentAlertStateIcon alertDetails={alertDetails} />
                  </Td>
                </Tr>
              );
            })
        )}
      </Tbody>
    </Table>
  );
};

export default IncidentsDetailsRowTable;
