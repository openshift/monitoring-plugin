import {
  Alert,
  AlertStates,
  RuleStates,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { toManagedRule } from '@/features/alert-management-api/pages/rules-page/utils/rules';
import {
  ManagedAlert,
  ManagedRule,
  RuleWithEnablement,
} from '@/features/alert-management-api/types/types';
import { toManagedAlert } from '@/features/alert-management-api/utils/alerts';

export const makeRule = (overrides: Partial<RuleWithEnablement> = {}): RuleWithEnablement => ({
  id: 'rid_example',
  name: 'Example',
  labels: {},
  alerts: [],
  annotations: {},
  duration: 0,
  query: 'up == 0',
  state: RuleStates.Inactive,
  type: 'alerting',
  ...overrides,
});

export const makeManagedRule = (overrides: Partial<ManagedRule> = {}): ManagedRule => ({
  ...toManagedRule(makeRule(overrides)),
  ...overrides,
});

export const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  activeAt: '2026-01-01T00:00:00Z',
  annotations: {},
  labels: { alertname: 'Example' },
  rule: makeRule(),
  state: AlertStates.Firing,
  value: '1',
  ...overrides,
});

export const makeManagedAlert = (overrides: Partial<ManagedAlert> = {}): ManagedAlert => ({
  ...toManagedAlert(makeAlert(overrides)),
  ...overrides,
});

export const makeSilence = (overrides: Partial<Silence> = {}): Silence => ({
  id: 'silence-example',
  comment: '',
  createdBy: 'admin',
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-01-02T00:00:00Z',
  firingAlerts: [],
  matchers: [{ name: 'alertname', value: 'Example', isEqual: true, isRegex: false }],
  status: { state: SilenceStates.Active },
  ...overrides,
});
