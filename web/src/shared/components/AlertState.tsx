import { Alert, AlertStates, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon, BellSlashIcon, OutlinedBellIcon } from '@patternfly/react-icons';
import {
  t_global_icon_color_disabled,
  t_global_text_color_disabled,
  t_global_text_color_subtle,
} from '@patternfly/react-tokens';
import { TFunction } from 'i18next';
import * as _ from 'lodash-es';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export const AlertState = memo(function AlertState({ state }: { state: AlertStates }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const icon = <AlertStateIcon state={state} />;

  return icon ? (
    <span
      style={{
        color: state === AlertStates.Silenced ? t_global_text_color_disabled.var : undefined,
      }}
    >
      {icon} {getAlertStateKey(state, t)}
    </span>
  ) : null;
});

export const AlertStateIcon = memo(function AlertStateIcon({ state }: { state: AlertStates }) {
  switch (state) {
    case AlertStates.Firing:
      return <BellIcon />;
    case AlertStates.Pending:
      return <OutlinedBellIcon />;
    case AlertStates.Silenced:
      return <BellSlashIcon color={t_global_icon_color_disabled.var} />;
    default:
      return null;
  }
});

export function AlertStateDescription({ alert }: { alert: Alert }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  if (!_.isEmpty(alert.silencedBy)) {
    return <StateTimestamp text={t('Ends')} timestamp={_.max(_.map(alert.silencedBy, 'endsAt'))} />;
  }
  if (alert.activeAt) {
    return <StateTimestamp text={t('Since')} timestamp={alert.activeAt} />;
  }
  return null;
}

export function StateTimestamp({ text, timestamp }: { text: string; timestamp: string }) {
  return (
    <div style={{ color: t_global_text_color_subtle.var }}>
      {text}&nbsp;
      <Timestamp timestamp={timestamp} className="pf-v6-u-display-inline" />
    </div>
  );
}

export const getAlertStateKey = (state: AlertStates, t: TFunction) => {
  switch (state) {
    case AlertStates.Firing:
      return t('Firing');
    case AlertStates.Pending:
      return t('Pending');
    case AlertStates.Silenced:
      return t('Silenced');
    default:
      return t('Not Firing');
  }
};
