import { Silence, SilenceStates } from '@openshift-console/dynamic-plugin-sdk';

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
