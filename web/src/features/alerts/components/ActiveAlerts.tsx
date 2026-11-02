import { AlertStates, PrometheusAlert, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { DropdownItem } from '@patternfly/react-core';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { AlertState } from '@/shared/components/AlertState';
import KebabDropdown from '@/shared/components/KebabDropdown';
import { LinkifyExternal } from '@/shared/console/utils/Link';
import { DataTestIDs } from '@/shared/constants/data-test';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import { getAlertUrl, getNewSilenceAlertUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { alertDescription } from '@/shared/utils/alerts/formatting';

// Plain-text parts are linkified (scheme-less URLs are assumed https://).
export const PrometheusTemplate = ({ text }: { text: string }) => (
  <>
    {text
      ?.split(/(\{\{[^{}]*\}\})/)
      ?.map((part: string, i: number) =>
        part.match(/^\{\{[^{}]*\}\}$/) ? (
          <code key={i}>{part}</code>
        ) : (
          <LinkifyExternal key={i}>{part}</LinkifyExternal>
        ),
      )}
  </>
);

type ActiveAlertsProps = {
  alerts: PrometheusAlert[];
  ruleID: string;
};

export const ActiveAlerts: FC<ActiveAlertsProps> = ({ alerts, ruleID }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const { namespace } = useMonitoringNamespace();

  return (
    <Table variant={TableVariant.compact}>
      <Thead>
        <Tr>
          <Th width={60}>{t('Description')}</Th>
          <Th width={15} visibility={['hiddenOnSm', 'visibleOnMd']}>
            {t('Active since')}
          </Th>
          <Th width={10}>{t('State')}</Th>
          <Th width={15}>{t('Value')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {_.sortBy<PrometheusAlert>(alerts, alertDescription).map((a, i) => (
          <Tr key={i}>
            <Td>
              <Link
                data-test={DataTestIDs.AlertResourceLink}
                to={getAlertUrl(perspective, a, ruleID, namespace)}
              >
                {alertDescription(a)}
              </Link>
            </Td>
            <Td>
              <Timestamp timestamp={a.activeAt} />
            </Td>
            <Td>
              <AlertState state={a.state} />
            </Td>
            <Td modifier="truncate">{a.value}</Td>
            {a.state !== AlertStates.Silenced && (
              <KebabDropdown
                dropdownItems={[
                  <DropdownItem
                    component="button"
                    key="silence"
                    onClick={() => navigate(getNewSilenceAlertUrl(perspective, a, namespace))}
                  >
                    {t('Silence alert')}
                  </DropdownItem>,
                ]}
              />
            )}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
