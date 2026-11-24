import type { PrometheusLabels } from '@openshift-console/dynamic-plugin-sdk';
import { useNavigate } from 'react-router';

import { getCreateSilenceUrl } from '@/features/alert-management-api/utils/urls';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';

export const useSilenceAlertNavigation = () => {
  const { namespace, setNamespace } = useMonitoringNamespace();
  const navigate = useNavigate();

  return {
    navigateToSilence: (labels: PrometheusLabels) => {
      if (labels.namespace && labels.namespace !== namespace) {
        setNamespace(labels.namespace);
      }
      navigate(getCreateSilenceUrl(labels), {
        // use to determine if the user can go back to the previous page,
        // ie. was already on the console, or if we need to reset to a default page
        state: { silenceCanGoBack: true },
      });
    },
  };
};
