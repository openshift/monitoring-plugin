import {
  Alert,
  AlertStates,
  Rule,
  RuleStates,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';

import {
  alertingApplySilences,
  alertingSetRulesLoaded,
  alertingSetSilencesLoaded,
} from '@/shared/store/actions';
import monitoringReducer from '@/shared/store/reducers';
import { defaultObserveState } from '@/shared/store/store';

describe('monitoringReducer', () => {
  it('reuses one cloned rule for multiple alerts with the same source and rule ID', () => {
    const rule: Rule = {
      id: 'high-cpu',
      sourceId: 'source-a',
      alerts: [
        {
          annotations: {},
          labels: { alertname: 'HighCPU' },
          state: AlertStates.Firing,
        },
        {
          annotations: {},
          labels: { alertname: 'HighMemory' },
          state: AlertStates.Firing,
        },
      ],
      annotations: {},
      duration: 0,
      labels: {},
      name: 'HighResourceUsage',
      query: 'up == 0',
      state: RuleStates.Firing,
      type: 'alerting',
    };
    const alerts: Alert[] = rule.alerts.map((alert) => ({
      ...alert,
      rule: { ...rule, alerts: rule.alerts.map((ruleAlert) => ({ ...ruleAlert })) },
    }));
    const silence = {
      comment: 'maintenance',
      createdBy: 'admin',
      endsAt: '2030-01-01T00:00:00Z',
      id: 'silence-id',
      matchers: [{ isEqual: true, isRegex: false, name: 'alertname', value: 'HighCPU' }],
      startsAt: '2020-01-01T00:00:00Z',
      status: { state: SilenceStates.Active },
      updatedAt: '2020-01-01T00:00:00Z',
    } as Silence;

    let state = monitoringReducer(
      defaultObserveState,
      alertingSetRulesLoaded('prometheus', 'default', [rule], alerts),
    );
    state = monitoringReducer(state, alertingSetSilencesLoaded('prometheus', 'default', [silence]));
    state = monitoringReducer(state, alertingApplySilences('prometheus', 'default'));

    const alertingData = state.alerting.prometheus.default;
    expect(alertingData.alerts[0].rule).toBe(alertingData.rules[0]);
    expect(alertingData.alerts[1].rule).toBe(alertingData.rules[0]);
    expect(alertingData.alerts.map((alert) => alert.state)).toEqual([
      AlertStates.Silenced,
      AlertStates.Firing,
    ]);
    expect(alertingData.rules[0].alerts.map((alert) => alert.state)).toEqual([
      AlertStates.Silenced,
      AlertStates.Firing,
    ]);
  });
});
