import type { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { Tooltip } from '@patternfly/react-core';
import { CheckCircleIcon, PauseCircleIcon, QuestionCircleIcon } from '@patternfly/react-icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertStateIcon, getAlertStateKey } from '@/shared/components/AlertState';

export type AlertRuleStateValue = AlertStates | 'enabled' | 'disabled' | 'unknown';

type Props = {
  state: AlertRuleStateValue;
  count?: number;
};

// Shared by the legacy per-alert-state counts and the management rule-state column.
export function AlertRuleState({ state, count }: Props) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  let icon: ReactNode;
  let label: string;

  switch (state) {
    case 'enabled':
      icon = (
        <CheckCircleIcon aria-hidden color="var(--pf-t--global--color--status--success--default)" />
      );
      label = t('Enabled');
      break;
    case 'disabled':
      icon = <PauseCircleIcon aria-hidden />;
      label = t('Disabled');
      break;
    case 'unknown':
      icon = <QuestionCircleIcon aria-hidden />;
      label = t('Unknown');
      break;
    default:
      icon = <AlertStateIcon state={state} />;
      label = getAlertStateKey(state, t);
  }

  const content = (
    <span style={{ whiteSpace: 'nowrap' }}>
      {icon} {count !== undefined && `${count} `}
      {label}
    </span>
  );
  if (state === 'unknown') {
    return (
      <Tooltip content={t('Rule enablement is not available from the API')}>{content}</Tooltip>
    );
  }
  return content;
}
