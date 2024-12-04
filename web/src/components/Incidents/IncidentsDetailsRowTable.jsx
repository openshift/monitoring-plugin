import React from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import {
  GreenCheckCircleIcon,
  PrometheusEndpoint,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon, ExclamationCircleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { Bullseye, Icon, Spinner, Tooltip } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { AlertResource, getAlertsAndRules } from '../utils';
import { MonitoringResourceIcon } from '../alerting/AlertUtils';
import { formatDateInExpandedDetails } from './utils';
import { isAlertingRulesSource } from '../console/extensions/alerts';
import { getPrometheusURL } from '../console/graphs/helpers';
import { fetchAlerts } from '../fetch-alerts';
import KebabDropdown from '../kebab-dropdown';
import { DropdownItem as DropdownItemDeprecated } from '@patternfly/react-core/deprecated';
import { useTranslation } from 'react-i18next';
import {
  getAlertUrl,
  getNewSilenceAlertUrl,
  getRuleUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import { useActiveNamespace } from '../console/console-shared/hooks/useActiveNamespace';

const IncidentsDetailsRowTable = ({ alerts }) => {
  const namespace = useActiveNamespace();
  const { perspective } = usePerspective();
  const [alertsWithMatchedData, setAlertsWithMatchedData] = React.useState([]);
  const [customExtensions] = useResolvedExtensions(isAlertingRulesSource);
  const { t } = useTranslation('plugin__monitoring-plugin');

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
          <Th width={25}>Alert name</Th>
          <Th width={15}>Namespace</Th>
          <Th width={10}>Severity</Th>
          <Th width={10}>State</Th>
          <Th width={20}>Firing started</Th>
          <Th width={20}>Firing ended</Th>
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
                      !alertDetails?.rule
                        ? { pointerEvents: 'none', color: 'inherit', textDecoration: 'inherit' }
                        : {}
                    }
                  >
                    {alertDetails.alertname}
                  </Link>
                  {!alertDetails?.rule && (
                    <Tooltip content={<div>No details can be shown for inactive alerts.</div>}>
                      <OutlinedQuestionCircleIcon style={{ marginLeft: '2px' }} />
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
                      <snap style={{ marginLeft: '2px' }}>Critical</snap>
                    </>
                  ) : alertDetails.severity === 'warning' ? (
                    <>
                      <Icon status="warning">
                        <ExclamationTriangleIcon />
                      </Icon>
                      <snap style={{ marginLeft: '2px' }}>Warning</snap>
                    </>
                  ) : (
                    <>
                      <Icon status="info">
                        <InfoCircleIcon />
                      </Icon>
                      <snap style={{ marginLeft: '2px' }}>Info</snap>
                    </>
                  )}
                </Td>
                <Td dataLabel="expanded-details-alertstate">
                  {!alertDetails.resolved ? (
                    <>
                      <BellIcon />
                      <snap style={{ marginLeft: '2px' }}>Firing</snap>
                    </>
                  ) : (
                    <>
                      <GreenCheckCircleIcon />
                      <snap style={{ marginLeft: '2px' }}>Resolved</snap>
                    </>
                  )}
                </Td>
                <Td dataLabel="expanded-details-firingstart">
                  {formatDateInExpandedDetails(alertDetails.alertsStartFiring)}
                </Td>
                <Td dataLabel="expanded-details-firingend">
                  {!alertDetails.resolved
                    ? '---'
                    : formatDateInExpandedDetails(alertDetails.alertsEndFiring)}
                </Td>
                <Td>
                  <KebabDropdown
                    dropdownItems={[
                      <DropdownItemDeprecated
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
                      </DropdownItemDeprecated>,
                      <DropdownItemDeprecated key="view-rule" isDisabled={!alertDetails?.rule}>
                        <Link
                          to={getRuleUrl(perspective, alertDetails.rule)}
                          style={{ color: 'inherit', textDecoration: 'inherit' }}
                        >
                          {t('View alerting rule')}
                        </Link>
                      </DropdownItemDeprecated>,
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
