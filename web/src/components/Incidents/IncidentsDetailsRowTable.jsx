import React from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  GreenCheckCircleIcon,
  PrometheusEndpoint,
  Timestamp,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon, ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { Bullseye, DropdownItem, Icon, Spinner, Tooltip } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { AlertResource, getAlertsAndRules } from '../utils';
import { MonitoringResourceIcon } from '../alerting/AlertUtils';
import { isAlertingRulesSource } from '../console/extensions/alerts';
import { getPrometheusURL } from '../console/graphs/helpers';
import { fetchAlerts } from '../fetch-alerts';
import KebabDropdown from '../kebab-dropdown';
import { useTranslation } from 'react-i18next';
import {
  getAlertUrl,
  getNewSilenceAlertUrl,
  getRuleUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { useActiveNamespace } from '../console/console-shared/hooks/useActiveNamespace';
import './incidents-styles.css';

const IncidentsDetailsRowTable = ({ alerts }) => {
  const namespace = useActiveNamespace();
  const { perspective } = usePerspective();
  const [alertsWithMatchedData, setAlertsWithMatchedData] = React.useState([]);
  const [customExtensions] = useResolvedExtensions(isAlertingRulesSource);
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const alertsSource = React.useMemo(
    () =>
      customExtensions
        .filter((extension) => extension.properties.contextId === 'observe-alerting')
        .map((extension) => extension.properties),
    [customExtensions],
  );

  function findMatchingAlertsWithId(alertsArray, rulesArray) {
    // Map over alerts and find matching rules
    return alertsArray.map((alert) => {
      const match = rulesArray.find((rule) => alert.alertname === rule.name);

      if (match) {
        return { ...alert, rule: match };
      }
      return alert;
    });
  }

  React.useEffect(() => {
    const url = getPrometheusURL({ endpoint: PrometheusEndpoint.RULES });
    const poller = () => {
      fetchAlerts(url, alertsSource)
        .then(({ data }) => {
          const { rules } = getAlertsAndRules(data);
          //match rules fetched with alerts passed to this component by alertname
          setAlertsWithMatchedData(findMatchingAlertsWithId(alerts, rules));
        })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.log(e);
        });
    };
    poller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  return (
    <Table borders={'compactBorderless'}>
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
                  <MonitoringResourceIcon resource={AlertResource} />
                  <Link
                    to={
                      alertDetails?.rule
                        ? getAlertUrl(perspective, alertDetails, alertDetails.rule.id, namespace)
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
                  {alertDetails.severity === 'critical' ? (
                    <>
                      <Icon status="danger">
                        <ExclamationCircleIcon />
                      </Icon>
                      <span className="expanded-details-text-margin">Critical</span>
                    </>
                  ) : alertDetails.severity === 'warning' ? (
                    <>
                      <Icon status="warning">
                        <ExclamationTriangleIcon />
                      </Icon>
                      <span className="expanded-details-text-margin">Warning</span>
                    </>
                  ) : (
                    <>
                      <Icon status="info">
                        <InfoCircleIcon />
                      </Icon>
                      <span className="expanded-details-text-margin">Info</span>
                    </>
                  )}
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
                        key="silence"
                        isDisabled={!alertDetails?.rule}
                      >
                        <Link
                          to={getNewSilenceAlertUrl(perspective, alertDetails)}
                          style={{ color: 'inherit', textDecoration: 'inherit' }}
                        >
                          {t('Silence alert')}
                        </Link>
                      </DropdownItem>,
                      <DropdownItem key="view-rule" isDisabled={!alertDetails?.rule}>
                        <Link
                          to={getRuleUrl(perspective, alertDetails.rule)}
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
