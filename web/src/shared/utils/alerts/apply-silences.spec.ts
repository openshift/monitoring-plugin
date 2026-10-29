import {
  Alert,
  AlertStates,
  Rule,
  RuleStates,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import { applySilences } from '@/shared/utils/alerts/apply-silences';

const createRule = (): Rule =>
  ({
    alerts: [
      {
        annotations: {},
        labels: { alertname: 'HighCPU', namespace: 'default' },
        state: AlertStates.Firing,
      },
    ],
    annotations: {},
    duration: 0,
    id: 'high-cpu',
    labels: { severity: 'critical' },
    name: 'HighCPU',
    query: 'up == 0',
    state: RuleStates.Firing,
    type: 'alerting',
  }) as Rule;

const createSilence = (overrides: Partial<Silence> = {}): Silence =>
  ({
    comment: 'maintenance',
    createdBy: 'admin',
    endsAt: '2030-01-01T00:00:00Z',
    id: 'silence-id',
    matchers: [{ isEqual: true, isRegex: false, name: 'alertname', value: 'HighCPU' }],
    startsAt: '2020-01-01T00:00:00Z',
    status: { state: SilenceStates.Active },
    updatedAt: '2020-01-01T00:00:00Z',
    ...overrides,
  }) as Silence;

const createAlert = (rule: Rule): Alert =>
  ({
    ...rule.alerts[0],
    rule,
  }) as Alert;

const expectSilenceNotToApply = (silence: Silence) => {
  const rule = createRule();
  const alert = createAlert(rule);

  const result = applySilences({ alerts: [alert], rules: [rule], silences: [silence] });

  expect(result.alerts[0].state).toBe(AlertStates.Firing);
  expect(result.alerts[0].silencedBy).toEqual([]);
  expect(result.rules[0].state).toBe(RuleStates.Firing);
  expect(result.silences[0].firingAlerts).toEqual([]);
};

describe('applySilences', () => {
  it('derives silence state without mutating query data', () => {
    const rule = createRule();
    const alert = createAlert(rule);
    const silence = createSilence();

    const result = applySilences({ alerts: [alert], rules: [rule], silences: [silence] });

    expect(result.alerts[0]).not.toBe(alert);
    expect(result.rules[0]).not.toBe(rule);
    expect(result.silences[0]).not.toBe(silence);
    expect(result.alerts[0].state).toBe(AlertStates.Silenced);
    expect(result.rules[0].state).toBe(RuleStates.Silenced);
    expect(result.silences[0].firingAlerts).toEqual([result.alerts[0]]);
    expect(alert.state).toBe(AlertStates.Firing);
    expect(rule.state).toBe(RuleStates.Firing);
    expect(silence.firingAlerts).toBeUndefined();
  });

  it('does not apply inactive silences', () => {
    const rule = createRule();
    const alert = createAlert(rule);
    const silence = createSilence({ status: { state: SilenceStates.Expired } });

    const result = applySilences({ alerts: [alert], rules: [rule], silences: [silence] });

    expect(result.alerts[0].state).toBe(AlertStates.Firing);
    expect(result.rules[0].state).toBe(RuleStates.Firing);
    expect(result.silences[0].firingAlerts).toEqual([result.alerts[0]]);
  });

  it('supports regex and negative matchers', () => {
    const rule = createRule();
    const alert = createAlert(rule);
    const silence = createSilence({
      matchers: [
        { isEqual: true, isRegex: true, name: 'alertname', value: 'High.*' },
        { isEqual: false, isRegex: false, name: 'namespace', value: 'openshift-monitoring' },
      ],
    });

    expect(
      applySilences({ alerts: [alert], rules: [rule], silences: [silence] }).alerts[0].state,
    ).toBe(AlertStates.Silenced);
  });

  it('does not apply an equality matcher for a different alert name', () => {
    expectSilenceNotToApply(
      createSilence({
        matchers: [{ isEqual: true, isRegex: false, name: 'alertname', value: 'HighMemory' }],
      }),
    );
  });

  it('does not apply a silence when any matcher does not match', () => {
    expectSilenceNotToApply(
      createSilence({
        matchers: [
          { isEqual: true, isRegex: false, name: 'alertname', value: 'HighCPU' },
          { isEqual: true, isRegex: false, name: 'namespace', value: 'openshift-monitoring' },
        ],
      }),
    );
  });

  it('does not apply a regex matcher when the alert name does not match', () => {
    expectSilenceNotToApply(
      createSilence({
        matchers: [{ isEqual: true, isRegex: true, name: 'alertname', value: 'HighMemory.*' }],
      }),
    );
  });

  it('does not apply a negative matcher when its value matches the alert label', () => {
    expectSilenceNotToApply(
      createSilence({
        matchers: [{ isEqual: false, isRegex: false, name: 'alertname', value: 'HighCPU' }],
      }),
    );
  });

  it('silences a pending rule without mutating the response', () => {
    const rule = createRule();
    rule.state = RuleStates.Pending;
    const alert = createAlert(rule);

    const result = applySilences({
      alerts: [alert],
      rules: [rule],
      silences: [createSilence()],
    });

    expect(result.rules[0].state).toBe(RuleStates.Silenced);
    expect(rule.state).toBe(RuleStates.Pending);
  });
});
