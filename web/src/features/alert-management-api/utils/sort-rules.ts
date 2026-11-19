import type { RuleColumn } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import type {
  ManagedRule,
  RuleFilterKey,
  TableSort,
} from '@/features/alert-management-api/types/types';
import { compareSeverities } from '@/features/alert-management-api/utils/sort-alerts';

export type RuleSort = TableSort<RuleColumn>;

export const defaultRuleSort: RuleSort = { column: 'name', direction: 'asc' };

const enablementOrder = ['Enabled', 'Disabled', 'Unknown'];

export function compareRuleFilterValues(key: RuleFilterKey, first: string, second: string): number {
  switch (key) {
    case 'enablement':
      return enablementOrder.indexOf(first) - enablementOrder.indexOf(second);
    case 'severity':
      return compareSeverities(first, second);
    default:
      return first.localeCompare(second);
  }
}

export function sortRules(rules: ManagedRule[], { column, direction }: RuleSort): ManagedRule[] {
  return [...rules].sort((a, b) => {
    let comparison: number;
    switch (column) {
      case 'severity':
        comparison = compareSeverities(a.severity, b.severity);
        break;
      case 'enablement':
        comparison =
          b.firingAlertCount - a.firingAlertCount ||
          b.pendingAlertCount - a.pendingAlertCount ||
          b.silencedAlertCount - a.silencedAlertCount;
        break;
      default:
        comparison = a[column].localeCompare(b[column]);
    }

    // fallback to name and then id comparison if other comparisons match
    comparison = comparison || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

    return comparison * (direction === 'asc' ? 1 : -1);
  });
}
