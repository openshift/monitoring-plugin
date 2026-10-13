import { Alert } from '@openshift-console/dynamic-plugin-sdk';
import { alertSource } from '../AlertUtils';
import { AlertFilterOptions, AggregatedAlertFilters } from '../AlertsPage';
import { alertState, ALL_NAMESPACES_KEY, fuzzyCaseInsensitive } from '../../utils';
import { Perspective } from '../../../store/actions';

export const filterAlerts = (
  alerts: Alert[],
  selectedFilters: AggregatedAlertFilters,
  namespace: string,
  perspective: Perspective,
) => {
  if (!alerts) {
    return [];
  }
  const shouldFilterNamespace = namespace !== ALL_NAMESPACES_KEY;

  /**
   * Filters alerts based on tenancy:
   * - with tenancy: alerts are automatically pre-filtered.
   * - without tenancy (admin): filters by selected namespace for UX consistency.
   * - "All Projects": returns all alerts, including those without a namespace label.
   */
  return alerts.filter((alert) => {
    if (shouldFilterNamespace && alert.labels?.namespace !== namespace) {
      return false;
    }
    // For each selectable filter, first check if it is set. If it isn't then we don't
    // filter
    if (
      selectedFilters[AlertFilterOptions.NAME] &&
      !fuzzyCaseInsensitive(selectedFilters[AlertFilterOptions.NAME], alert.labels?.alertname)
    ) {
      return false;
    }
    if (
      selectedFilters[AlertFilterOptions.STATE].length > 0 &&
      !selectedFilters[AlertFilterOptions.STATE].includes(alertState(alert))
    ) {
      return false;
    }
    if (
      selectedFilters[AlertFilterOptions.SEVERITY].length > 0 &&
      !selectedFilters[AlertFilterOptions.SEVERITY].includes(alert.labels?.severity)
    ) {
      return false;
    }
    if (
      selectedFilters[AlertFilterOptions.SOURCE]?.length > 0 &&
      !selectedFilters[AlertFilterOptions.SOURCE].some(
        (filter) => String(filter) === alertSource(alert),
      )
    ) {
      return false;
    }
    if (selectedFilters[AlertFilterOptions.LABEL].length) {
      // labels are stored in the url as a single query param with the format of
      // label=a=b,c=d where the = and , are % encoded. selectedFilters[AlertFilterOptions.LABEL]
      // should contain the unencoded the label param
      const labelMatchers = selectedFilters[AlertFilterOptions.LABEL].split(',');
      for (const labelMatcher of labelMatchers) {
        const keyValue = labelMatcher.split('=');
        if (keyValue.length !== 2) {
          return false;
        }
        const [key, value] = keyValue;
        if (alert.labels?.[key] !== value) {
          return false;
        }
      }
    }
    if (
      perspective === 'acm' &&
      selectedFilters[AlertFilterOptions.CLUSTER]?.length > 0 &&
      !selectedFilters[AlertFilterOptions.CLUSTER].some((filter) =>
        fuzzyCaseInsensitive(filter, alert.labels?.cluster),
      )
    ) {
      return false;
    }
    return true;
  });
};
