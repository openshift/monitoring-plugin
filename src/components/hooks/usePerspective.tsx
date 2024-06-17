import { useActivePerspective } from '@openshift-console/dynamic-plugin-sdk';
import { Perspective } from 'src/actions/observe';

export const usePerspective = (): [Perspective, 'rules' | 'devRules', 'alerts' | 'devAlerts'] => {
  const [perspective] = useActivePerspective();

  if (perspective === 'dev') {
    return ['dev', 'devRules', 'devAlerts'];
  }
  return ['admin', 'rules', 'alerts'];
};
