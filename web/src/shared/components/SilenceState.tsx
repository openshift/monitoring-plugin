import {
  GreenCheckCircleIcon,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';
import { BanIcon, HourglassHalfIcon } from '@patternfly/react-icons';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { silenceState } from '@/shared/utils/alerts/formatting';

export const SilenceState = ({ silence }: { silence: Silence }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  let icon: ReactElement | null = null;
  let label = '';
  switch (silenceState(silence)) {
    case SilenceStates.Active:
      icon = <GreenCheckCircleIcon />;
      label = t('Active');
      break;
    case SilenceStates.Pending:
      icon = <HourglassHalfIcon />;
      label = t('Pending');
      break;
    case SilenceStates.Expired:
      icon = <BanIcon data-test-id="ban-icon" />;
      label = t('Expired');
      break;
  }
  return icon ? (
    <>
      {icon} {label}
    </>
  ) : null;
};
