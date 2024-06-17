import { useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective } from 'src/actions/observe';
import { AlertSource } from '../types';

type usePerspectiveReturn = {
  perspective: Perspective;
  isDev: boolean;
  rulesKey: 'devRules' | 'rules';
  alertsKey: 'devAlerts' | 'alerts';
  defaultAlertTenant: AlertSource;
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  if (perspective === 'dev') {
    return {
      perspective: 'dev',
      isDev: true,
      rulesKey: 'devRules',
      alertsKey: 'devAlerts',
      defaultAlertTenant: AlertSource.User,
    };
  }
  return {
    perspective: 'admin',
    isDev: false,
    rulesKey: 'rules',
    alertsKey: 'alerts',
    defaultAlertTenant: AlertSource.Platform,
  };
};
