import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { fuzzyCaseInsensitive } from '../utils';
import { AlertRulesFilterOptions, AlertRulesFilters } from './AlertRulesPage';
import { alertingRuleSource } from './AlertUtils';
import { AlertSource } from '../types';

export const filterRules = (rules: Rule[], selectedFilters: AlertRulesFilters) => {
  if (!rules) {
    return [];
  }

  /**
   * Filters alerts based on tenancy:
   * - with tenancy: alerts are automatically pre-filtered.
   * - without tenancy (admin): filters by selected namespace for UX consistency.
   * - "All Projects": returns all alerts, including those without a namespace label.
   */
  return rules.filter((rule) => {
    // For each selectable filter, first check if it is set. If it isn't then we don't
    // filter
    if (
      selectedFilters[AlertRulesFilterOptions.NAME] &&
      !fuzzyCaseInsensitive(selectedFilters[AlertRulesFilterOptions.NAME], rule?.name)
    ) {
      return false;
    }
    if (
      selectedFilters[AlertRulesFilterOptions.STATE].length > 0 &&
      !selectedFilters[AlertRulesFilterOptions.STATE].some((state) =>
        ruleHasAlertState(rule, state as AlertStates),
      )
    ) {
      return false;
    }
    if (
      selectedFilters[AlertRulesFilterOptions.SEVERITY].length > 0 &&
      !selectedFilters[AlertRulesFilterOptions.SEVERITY].includes(rule?.labels?.severity)
    ) {
      return false;
    }
    if (
      selectedFilters[AlertRulesFilterOptions.SOURCE].length > 0 &&
      !selectedFilters[AlertRulesFilterOptions.SOURCE].includes(
        alertingRuleSource(rule) as AlertSource,
      )
    ) {
      return false;
    }
    return true;
  });
};

export const ruleHasAlertState = (rule: Rule, state: AlertStates): boolean =>
  state === AlertStates.NotFiring ? _.isEmpty(rule.alerts) : _.some(rule.alerts, { state });
