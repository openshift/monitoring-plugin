import * as React from 'react';
import { usePerspective } from '../hooks/usePerspective';
import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import { useRulesAlertsPoller } from '../hooks/useRulesAlertsPoller';
import { useSilencesPoller } from '../hooks/useSilencesPoller';

const useAlertsPoll = () => {
  const { alertingContextId } = usePerspective();

  const [namespace] = useActiveNamespace();

  const [customExtensions] =
    useResolvedExtensions<AlertingRulesSourceExtension>(isAlertingRulesSource);

  const alertsSource = React.useMemo(
    () =>
      customExtensions
        .filter((extension) => extension.properties.contextId === alertingContextId)
        .map((extension) => extension.properties),
    [customExtensions, alertingContextId],
  );

  useRulesAlertsPoller(namespace, alertsSource);
  useSilencesPoller({ namespace });
};

export default useAlertsPoll;
