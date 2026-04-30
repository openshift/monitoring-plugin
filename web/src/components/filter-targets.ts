import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { Target } from './types';
import { TargetsFilterOptions, TargetsFilters } from './targets-page';
import { fuzzyCaseInsensitive, targetSource } from './utils';
import { isEmpty, some } from 'lodash-es';

export const filterTargets = (targets: Target[], selectedFilters: TargetsFilters) => {
  if (!targets) {
    return [];
  }

  /**
   * Filters alerts based on tenancy:
   * - with tenancy: alerts are automatically pre-filtered.
   * - without tenancy (admin): filters by selected namespace for UX consistency.
   * - "All Projects": returns all alerts, including those without a namespace label.
   */
  return targets.filter((target) => {
    // For each selectable filter, first check if it is set. If it isn't then we don't
    // filter
    if (
      selectedFilters[TargetsFilterOptions.NAME] &&
      // Either the scapeUrl or the namespace matches
      !(
        fuzzyCaseInsensitive(selectedFilters[TargetsFilterOptions.NAME], target.scrapeUrl) ||
        fuzzyCaseInsensitive(selectedFilters[TargetsFilterOptions.NAME], target.labels?.namespace)
      )
    ) {
      return false;
    }
    if (
      selectedFilters[TargetsFilterOptions.STATUS].length > 0 &&
      !selectedFilters[TargetsFilterOptions.STATUS].includes(target.health)
    ) {
      return false;
    }
    if (
      selectedFilters[TargetsFilterOptions.SOURCE].length > 0 &&
      !selectedFilters[TargetsFilterOptions.SOURCE].includes(targetSource(target))
    ) {
      return false;
    }
    if (selectedFilters[TargetsFilterOptions.LABEL].length) {
      // labels are stored in the url as a single query param with the format of
      // label=a=b,c=d where the = and , are % encoded. selectedFilters[AlertFilterOptions.LABEL]
      // should contain the unencoded the label param
      const labelMatchers = selectedFilters[TargetsFilterOptions.LABEL].split(',');
      for (const labelMatcher of labelMatchers) {
        const keyValue = labelMatcher.split('=');
        if (keyValue.length !== 2) {
          return false;
        }
        const [key, value] = keyValue;
        if (target.labels?.[key] !== value) {
          return false;
        }
      }
    }
    return true;
  });
};

export const ruleHasAlertState = (rule: Rule, state: AlertStates): boolean =>
  state === AlertStates.NotFiring ? isEmpty(rule.alerts) : some(rule.alerts, { state });
