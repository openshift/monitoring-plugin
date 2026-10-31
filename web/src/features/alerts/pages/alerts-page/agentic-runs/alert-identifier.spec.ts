import { Alert, AlertStates, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

import {
  getAlertFingerprintPrefix,
  matchesAgenticRun,
} from '@/features/alerts/pages/alerts-page/agentic-runs/alert-identifier';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

const makeAlert = (labels: Record<string, string>): Alert =>
  ({
    labels: { alertname: 'TestAlert', ...labels },
    annotations: {},
    state: AlertStates.Firing,
    rule: { id: '1', alerts: [], labels: {}, name: 'TestAlert', query: '', duration: 0 },
  }) as unknown as Alert;

const makeAgenticRun = (labels: Record<string, string>): K8sResourceCommon => ({
  apiVersion: 'agentic.openshift.io/v1alpha1',
  kind: 'AgenticRun',
  metadata: {
    name: 'test-proposal',
    namespace: 'openshift-lightspeed',
    labels,
  },
});

describe('getAlertFingerprintPrefix', () => {
  it('returns the first 8 characters of the fingerprint', () => {
    const labels = { alertname: 'TestAlert' };
    const fp = computeAlertFingerprint(labels);
    const prefix = getAlertFingerprintPrefix(labels);
    expect(prefix).toHaveLength(8);
    expect(fp.startsWith(prefix)).toBe(true);
  });
});

describe('matchesProposal', () => {
  it('matches by fingerprint prefix', () => {
    const alert = makeAlert({ severity: 'critical' });
    const fp8 = getAlertFingerprintPrefix(alert.labels);
    const proposal = makeAgenticRun({
      'agentic.openshift.io/alert-fingerprint': fp8,
      'agentic.openshift.io/source': 'alertmanager',
    });
    expect(matchesAgenticRun(alert, proposal)).toBe(true);
  });

  it('does not match when fingerprint differs', () => {
    const alert = makeAlert({ severity: 'critical' });
    const proposal = makeAgenticRun({
      'agentic.openshift.io/alert-fingerprint': 'deadbeef',
      'agentic.openshift.io/source': 'alertmanager',
    });
    expect(matchesAgenticRun(alert, proposal)).toBe(false);
  });

  it('does not match when proposal has no fingerprint label', () => {
    const alert = makeAlert({ severity: 'warning' });
    const proposal = makeAgenticRun({
      'agentic.openshift.io/alert-name': 'testalert',
      'agentic.openshift.io/alert-severity': 'warning',
    });
    expect(matchesAgenticRun(alert, proposal)).toBe(false);
  });
});
