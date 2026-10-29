import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';

import {
  AlertRulesFilterOptions,
  AlertRulesFilters,
  filterRules,
  ruleHasAlertState,
} from '@/features/alerts/pages/alert-rules-page/filter-rules';
import { AlertSource } from '@/shared/types/types';

const emptyFilters: AlertRulesFilters = {
  [AlertRulesFilterOptions.NAME]: '',
  [AlertRulesFilterOptions.STATE]: [],
  [AlertRulesFilterOptions.SEVERITY]: [],
  [AlertRulesFilterOptions.SOURCE]: [],
  [AlertRulesFilterOptions.LABEL]: '',
};

const makeRule = (overrides): Rule => ({
  alerts: [],
  labels: {},
  ...overrides,
});

const platformRule = makeRule({
  name: 'HighMemory',
  labels: { severity: 'critical', prometheus: 'openshift-monitoring/k8s' },
  alerts: [{ state: AlertStates.Firing, labels: {}, annotations: {} }],
});

const userRule = makeRule({
  name: 'CustomAlert',
  labels: { severity: 'warning' },
  alerts: [{ state: AlertStates.Pending, labels: {}, annotations: {} }],
});

const silentRule = makeRule({
  name: 'SilencedRule',
  labels: { severity: 'info' },
  alerts: [],
});

const rules = [platformRule, userRule, silentRule];

const expectRuleNames = (result: Rule[], names: string[]) => {
  expect(result.filter(({ name }) => names.includes(name)).map(({ name }) => name)).toEqual(names);
  expect(result.every(({ name }) => names.includes(name))).toBe(true);
};

describe('filterRules', () => {
  it('should return empty array for null input', () => {
    expect(filterRules(null, emptyFilters)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(filterRules(undefined, emptyFilters)).toEqual([]);
  });

  it('should return all rules when no filters are set', () => {
    expectRuleNames(filterRules(rules, emptyFilters), [
      'HighMemory',
      'CustomAlert',
      'SilencedRule',
    ]);
  });

  it('should filter by name (case insensitive, fuzzy)', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.NAME]: 'high' };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['HighMemory']);
  });

  it('should filter by state - Firing', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.STATE]: [AlertStates.Firing] };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['HighMemory']);
  });

  it('should filter by state - NotFiring (rules with no alerts)', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.STATE]: [AlertStates.NotFiring],
    };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['SilencedRule']);
  });

  it('should filter by multiple states', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.STATE]: [AlertStates.Firing, AlertStates.Pending],
    };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['HighMemory', 'CustomAlert']);
  });

  it('should filter by severity', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.SEVERITY]: ['warning'] };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['CustomAlert']);
  });

  it('should filter by source', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.SOURCE]: [AlertSource.User],
    };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['CustomAlert', 'SilencedRule']);
  });

  describe('label filter', () => {
    it('should filter by single label key=value', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical',
      };
      const result = filterRules(rules, filters);
      expectRuleNames(result, ['HighMemory']);
    });

    it('should filter by multiple comma-separated labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical,prometheus=openshift-monitoring/k8s',
      };
      const result = filterRules(rules, filters);
      expectRuleNames(result, ['HighMemory']);
    });

    it('should exclude rules that do not match all labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical,prometheus=user-workload',
      };
      const result = filterRules(rules, filters);
      expectRuleNames(result, []);
    });

    it('should reject malformed label matchers', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'badformat',
      };
      const result = filterRules(rules, filters);
      expectRuleNames(result, []);
    });
  });

  it('should apply combined filters', () => {
    const filters: AlertRulesFilters = {
      [AlertRulesFilterOptions.NAME]: '',
      [AlertRulesFilterOptions.STATE]: [AlertStates.Firing],
      [AlertRulesFilterOptions.SEVERITY]: ['critical'],
      [AlertRulesFilterOptions.SOURCE]: [],
      [AlertRulesFilterOptions.LABEL]: '',
    };
    const result = filterRules(rules, filters);
    expectRuleNames(result, ['HighMemory']);
  });
});

describe('ruleHasAlertState', () => {
  it('should return true for NotFiring when rule has no alerts', () => {
    expect(ruleHasAlertState(silentRule, AlertStates.NotFiring)).toBe(true);
  });

  it('should return false for NotFiring when rule has alerts', () => {
    expect(ruleHasAlertState(platformRule, AlertStates.NotFiring)).toBe(false);
  });

  it('should return true when rule has alert in the given state', () => {
    expect(ruleHasAlertState(platformRule, AlertStates.Firing)).toBe(true);
    expect(ruleHasAlertState(userRule, AlertStates.Pending)).toBe(true);
  });

  it('should return false when rule has no alert in the given state', () => {
    expect(ruleHasAlertState(platformRule, AlertStates.Pending)).toBe(false);
  });
});
