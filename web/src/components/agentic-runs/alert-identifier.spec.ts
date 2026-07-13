jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

import { Alert, AlertStates, K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import {
  computeAlertFingerprint,
  getAlertFingerprintPrefix,
  matchesAgenticRun,
} from './alert-identifier';

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

describe('computeAlertFingerprint', () => {
  it('returns a 16-char hex string', () => {
    const fp = computeAlertFingerprint({ alertname: 'TestAlert', severity: 'critical' });
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same labels', () => {
    const labels = { alertname: 'HighMemory', severity: 'warning', namespace: 'default' };
    expect(computeAlertFingerprint(labels)).toBe(computeAlertFingerprint(labels));
  });

  it('produces the same result regardless of label insertion order', () => {
    const fp1 = computeAlertFingerprint({ b: '2', a: '1' });
    const fp2 = computeAlertFingerprint({ a: '1', b: '2' });
    expect(fp1).toBe(fp2);
  });

  it('produces different fingerprints for different labels', () => {
    const fp1 = computeAlertFingerprint({ alertname: 'AlertA' });
    const fp2 = computeAlertFingerprint({ alertname: 'AlertB' });
    expect(fp1).not.toBe(fp2);
  });

  it('returns empty label fingerprint for empty input', () => {
    const fp = computeAlertFingerprint({});
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });
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
