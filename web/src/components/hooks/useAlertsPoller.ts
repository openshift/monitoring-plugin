import {
  AlertingRulesSourceExtension,
  isAlertingRulesSource,
  useActiveNamespace,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import * as React from 'react';
import { usePerspective } from './usePerspective';
import { useRulesAlertsPoller } from './useRulesAlertsPoller';
import { useSilencesPoller } from './useSilencesPoller';

export const useAlertsPoller = () => {
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
