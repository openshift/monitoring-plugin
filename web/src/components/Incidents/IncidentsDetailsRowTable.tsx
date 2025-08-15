import { useRef, useState, useEffect } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  GreenCheckCircleIcon,
  ResourceIcon,
  Timestamp,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon } from '@patternfly/react-icons';
import { Bullseye, DropdownItem, Spinner, Tooltip } from '@patternfly/react-core';
import { Link, useHistory } from 'react-router-dom';
import { AlertResource } from '../utils';
import KebabDropdown from '../kebab-dropdown';
import { useTranslation } from 'react-i18next';
import {
  getAlertUrl,
  getLegacyObserveState,
  getNewSilenceAlertUrl,
  getRuleUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import './incidents-styles.css';
import { SeverityBadge } from '../alerting/AlertUtils';
import { useAlertsPoller } from '../hooks/useAlertsPoller';
import { useSelector } from 'react-redux';
import isEqual from 'lodash/isEqual';
import { MonitoringState } from 'src/reducers/observe';

function useDeepCompareMemoize(value) {
  const ref = useRef();

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

const IncidentsDetailsRowTable = ({ alerts }) => {
  const history = useHistory();
  const [namespace] = useActiveNamespace();
  useAlertsPoller();
  const { perspective, alertsKey } = usePerspective();
  const [alertsWithMatchedData, setAlertsWithMatchedData] = useState([]);
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const alertsWithLabels = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(alertsKey),
  );

  function findMatchingAlertsWithId(alertsArray, rulesArray) {
    return alertsArray.map((alert) => {
      if (!Array.isArray(rulesArray?.data)) {
        return alert;
      }
      const match = rulesArray.data.find((rule) => alert.alertname === rule.labels.alertname);
      if (match) {
        return { ...alert, rule: match };
      }
      return alert;
    });
  }
  const memoizedAlerts = useDeepCompareMemoize(alerts);

  useEffect(() => {
    setAlertsWithMatchedData(findMatchingAlertsWithId(memoizedAlerts, alertsWithLabels));
  }, [memoizedAlerts, alertsWithLabels]);

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
        {!alertsWithMatchedData ? (
          <Bullseye>
            <Spinner aria-label="incidents-chart-spinner" />
          </Bullseye>
        ) : (
          alertsWithMatchedData?.map((alertDetails, rowIndex) => {
            return (
              <Tr key={rowIndex}>
                <Td dataLabel="expanded-details-alertname">
                  <ResourceIcon kind={AlertResource.kind} />
                  <Link
                    to={
                      alertDetails?.rule
                        ? getAlertUrl(
                            perspective,
                            alertDetails,
                            alertDetails?.rule?.rule.id,
                            namespace,
                          )
                        : '#'
                    }
                    style={
                      !alertDetails?.rule || alertDetails.resolved
                        ? { pointerEvents: 'none', color: 'inherit', textDecoration: 'inherit' }
                        : {}
                    }
                  >
                    {alertDetails.alertname}
                  </Link>
                  {(!alertDetails?.rule || alertDetails.resolved) && (
                    <Tooltip content={<div>No details can be shown for inactive alerts.</div>}>
                      <OutlinedQuestionCircleIcon className="expanded-details-text-margin" />
                    </Tooltip>
                  )}
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
                <Td>
                  <KebabDropdown
                    dropdownItems={[
                      <DropdownItem
                        component="button"
                        key="silence alert"
                        isDisabled={!alertDetails?.rule}
                        onClick={() =>
                          history.push(
                            getNewSilenceAlertUrl(perspective, alertDetails.rule, namespace),
                          )
                        }
                      >
                        {t('Silence alert')}
                      </DropdownItem>,
                      <DropdownItem
                        key="view-rule"
                        isDisabled={alertDetails?.alertstate === 'resolved' ? true : false}
                      >
                        <Link
                          to={getRuleUrl(perspective, alertDetails?.rule?.rule)}
                          style={{ color: 'inherit', textDecoration: 'inherit' }}
                        >
                          {t('View alerting rule')}
                        </Link>
                      </DropdownItem>,
                    ]}
                  />
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
