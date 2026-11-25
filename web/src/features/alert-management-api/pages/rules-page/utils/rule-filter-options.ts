import { TFunction } from 'i18next';

import {
  getRuleAlertStateValues,
  getRuleLabelValues,
  ruleFilterLabels,
  ruleLabel,
} from '@/features/alert-management-api/pages/rules-page/utils/rules';
import {
  AlertFilterOption,
  ManagedRule,
  RuleFilterKey,
} from '@/features/alert-management-api/types/types';
import { compareRuleFilterValues } from '@/features/alert-management-api/utils/sort-rules';
import { startCase } from '@/shared/utils/strings';

const filterKeys = Object.keys(ruleFilterLabels) as RuleFilterKey[];

export function getRuleFilterOptions(
  rules: ManagedRule[],
  t: TFunction,
): Record<RuleFilterKey, AlertFilterOption[]> {
  // filter => label => count
  const filterCounts = Object.fromEntries(
    filterKeys.map((key) => [key, new Map<string, number>()]),
  ) as Record<RuleFilterKey, Map<string, number>>;

  rules.forEach((rule) => {
    filterKeys.forEach((key) => {
      let values: string[];
      if (key === 'labels') {
        values = getRuleLabelValues(rule);
      } else if (key === 'alertStates') {
        values = getRuleAlertStateValues(rule);
      } else {
        values = [rule[key]];
      }
      values.filter(Boolean).forEach((value) => {
        const currentCount = filterCounts[key].get(value) ?? 0;
        filterCounts[key].set(value, currentCount + 1);
      });
    });
  });

  return Object.fromEntries(
    filterKeys.map((key) => [
      key,
      [...filterCounts[key]]
        .sort(([a], [b]) => compareRuleFilterValues(key, a, b))
        .map(([value, count]) => {
          let label = value;
          if (key === 'source') {
            label = t(startCase(value));
          } else if (key === 'managedBy') {
            label = ruleLabel(value, t);
          } else if (key !== 'labels' && key !== 'namespace' && key !== 'component') {
            label = t(value);
          }
          return { value, count, label };
        }),
    ]),
  ) as Record<RuleFilterKey, AlertFilterOption[]>;
}
