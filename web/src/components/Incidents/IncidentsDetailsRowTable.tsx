import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  GreenCheckCircleIcon,
  ResourceIcon,
  Timestamp,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon } from '@patternfly/react-icons';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { AlertResource } from '../utils';
import { useTranslation } from 'react-i18next';
import { getRuleUrl, usePerspective } from '../hooks/usePerspective';
import './incidents-styles.css';
import { SeverityBadge } from '../alerting/AlertUtils';

const IncidentsDetailsRowTable = ({ alerts }) => {
  const [namespace] = useActiveNamespace();
  const { perspective } = usePerspective();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Table borders={false} variant="compact">
      <Thead>
        <Tr>
          <Th width={25}>{t('Alert Name')}</Th>
          <Th width={15}>{t('Namespace')}</Th>
          <Th width={10}>{t('Severity')}</Th>
          <Th width={10}>{t('State')}</Th>
          <Th width={20}>{t('Start')}</Th>
          <Th width={20}>{t('End')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {!alerts ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          alerts?.map((alertDetails, rowIndex) => {
            return (
              <Tr key={rowIndex}>
                <Td dataLabel="expanded-details-alertname">
                  <ResourceIcon kind={AlertResource.kind} />
                  <Link to={getRuleUrl(perspective, alertDetails?.rule, namespace)}>
                    {alertDetails.alertname}
                  </Link>
                </Td>
                <Td dataLabel="expanded-details-namespace">{alertDetails.namespace || '---'}</Td>
                <Td dataLabel="expanded-details-severity">
                  <SeverityBadge severity={alertDetails.severity} />
                </Td>
                <Td dataLabel="expanded-details-alertstate">
                  {!alertDetails.resolved ? (
                    <>
                      <BellIcon />
                      <span className="expanded-details-text-margin">Firing</span>
                    </>
                  ) : (
                    <>
                      <GreenCheckCircleIcon />
                      <span className="expanded-details-text-margin">Resolved</span>
                    </>
                  )}
                </Td>
                <Td dataLabel="expanded-details-firingstart">
                  <Timestamp simple={true} timestamp={alertDetails.alertsStartFiring} />
                </Td>
                <Td dataLabel="expanded-details-firingend">
                  {!alertDetails.resolved ? (
                    '---'
                  ) : (
                    <Timestamp simple={true} timestamp={alertDetails.alertsEndFiring} />
                  )}
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
