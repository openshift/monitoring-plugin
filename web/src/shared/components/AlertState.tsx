import { AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import { BellIcon, BellSlashIcon, OutlinedBellIcon } from '@patternfly/react-icons';
import {
  t_global_icon_color_disabled,
  t_global_text_color_disabled,
} from '@patternfly/react-tokens';
import { TFunction } from 'i18next';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export const AlertState = memo(({ state }: { state: AlertStates }) => {
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

AlertState.displayName = 'AlertState';

export const AlertStateIcon = memo(({ state }: { state: AlertStates }) => {
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

AlertStateIcon.displayName = 'AlertStateIcon';

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
