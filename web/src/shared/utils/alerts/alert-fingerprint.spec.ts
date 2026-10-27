import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

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
