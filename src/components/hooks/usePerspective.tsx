import { useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective } from 'src/actions/observe';

type usePerspectiveReturn = {
  perspective: Perspective;
  rulesKey: 'devRules' | 'rules';
  alertsKey: 'devAlerts' | 'alerts';
};

export const usePerspective = (): usePerspectiveReturn => {
  const [perspective] = useActivePerspective();

  if (perspective === 'dev') {
    return { perspective: 'dev', rulesKey: 'devRules', alertsKey: 'devAlerts' };
  }
  return { perspective: 'admin', rulesKey: 'rules', alertsKey: 'alerts' };
};
