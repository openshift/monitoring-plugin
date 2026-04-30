jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

jest.mock('./AlertUtils', () => ({
  alertingRuleSource: (rule: any) =>
    rule.labels?.prometheus === 'openshift-monitoring/k8s' ? 'platform' : 'user',
}));

import { AlertStates, Rule } from '@openshift-console/dynamic-plugin-sdk';
import { AlertSource } from '../types';
import { filterRules, ruleHasAlertState } from './filter-rules';
import { AlertRulesFilterOptions, AlertRulesFilters } from './AlertRulesPage';

const emptyFilters: AlertRulesFilters = {
  [AlertRulesFilterOptions.NAME]: '',
  [AlertRulesFilterOptions.STATE]: [],
  [AlertRulesFilterOptions.SEVERITY]: [],
  [AlertRulesFilterOptions.SOURCE]: [],
  [AlertRulesFilterOptions.LABEL]: '',
};

const makeRule = (overrides: Partial<Rule> & { name: string }): Rule =>
  ({
    alerts: [],
    labels: {},
    ...overrides,
  }) as unknown as Rule;

const platformRule = makeRule({
  name: 'HighMemory',
  labels: { severity: 'critical', prometheus: 'openshift-monitoring/k8s' },
  alerts: [{ state: AlertStates.Firing, labels: {}, annotations: {} }] as any,
});

const userRule = makeRule({
  name: 'CustomAlert',
  labels: { severity: 'warning' },
  alerts: [{ state: AlertStates.Pending, labels: {}, annotations: {} }] as any,
});

const silentRule = makeRule({
  name: 'SilencedRule',
  labels: { severity: 'info' },
  alerts: [],
});

const rules = [platformRule, userRule, silentRule];

describe('filterRules', () => {
  it('should return empty array for null input', () => {
    expect(filterRules(null as any, emptyFilters)).toEqual([]);
  });

  it('should return empty array for undefined input', () => {
    expect(filterRules(undefined as any, emptyFilters)).toEqual([]);
  });

  it('should return all rules when no filters are set', () => {
    expect(filterRules(rules, emptyFilters)).toHaveLength(3);
  });

  it('should filter by name (case insensitive, fuzzy)', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.NAME]: 'high' };
    const result = filterRules(rules, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HighMemory');
  });

  it('should filter by state - Firing', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.STATE]: [AlertStates.Firing] };
    const result = filterRules(rules, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HighMemory');
  });

  it('should filter by state - NotFiring (rules with no alerts)', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.STATE]: [AlertStates.NotFiring],
    };
    const result = filterRules(rules, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('SilencedRule');
  });

  it('should filter by multiple states', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.STATE]: [AlertStates.Firing, AlertStates.Pending],
    };
    const result = filterRules(rules, filters);
    expect(result).toHaveLength(2);
  });

  it('should filter by severity', () => {
    const filters = { ...emptyFilters, [AlertRulesFilterOptions.SEVERITY]: ['warning'] };
    const result = filterRules(rules, filters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('CustomAlert');
  });

  it('should filter by source', () => {
    const filters = {
      ...emptyFilters,
      [AlertRulesFilterOptions.SOURCE]: [AlertSource.User],
    };
    const result = filterRules(rules, filters);
    expect(result.every((r) => r.labels?.prometheus !== 'openshift-monitoring/k8s')).toBe(true);
  });

  describe('label filter', () => {
    it('should filter by single label key=value', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical',
      };
      const result = filterRules(rules, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('HighMemory');
    });

    it('should filter by multiple comma-separated labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical,prometheus=openshift-monitoring/k8s',
      };
      const result = filterRules(rules, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('HighMemory');
    });

    it('should exclude rules that do not match all labels', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'severity=critical,prometheus=user-workload',
      };
      const result = filterRules(rules, filters);
      expect(result).toHaveLength(0);
    });

    it('should reject malformed label matchers', () => {
      const filters = {
        ...emptyFilters,
        [AlertRulesFilterOptions.LABEL]: 'badformat',
      };
      const result = filterRules(rules, filters);
      expect(result).toHaveLength(0);
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
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('HighMemory');
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
