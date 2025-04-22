import { Alert } from '@openshift-console/dynamic-plugin-sdk';
import { FILTER_TYPES, SelectedFilters } from '../../useSelectedFilters';
import { alertSource } from '../../AlertUtils';

export const alertFilters: Record<string, (selectedInput: string[], alert: Alert) => boolean> = {
  [FILTER_TYPES.ALERT_STATE]: (selectedInput, obj) => {
    if (!selectedInput) return true;
    return selectedInput.some((selectedState) => obj.state === selectedState);
  },
  [FILTER_TYPES.ALERT_SOURCE]: (selectedInput, obj) => {
    if (!selectedInput) return true;
    return selectedInput.some((selectedSource) => alertSource(obj) === selectedSource);
  },
  [FILTER_TYPES.ALERT_CLUSTER]: (selectedInput, obj) => {
    if (!selectedInput) return true;
    return selectedInput.some((selectedCluster) => obj.labels?.cluster === selectedCluster);
  },
} as const;

export const filterAlerts = (alerts: Alert[], selectedFilters: SelectedFilters) => {
  if (!Object.keys(selectedFilters)?.length) return alerts;

  return (alerts || []).filter((alert) =>
    Object.keys(selectedFilters).every((filterType) => {
      const selectedValues = selectedFilters[filterType];
      const filter = alertFilters[filterType];

      if (!filter) return true;

      return filter(selectedValues, alert);
    }),
  );
};
