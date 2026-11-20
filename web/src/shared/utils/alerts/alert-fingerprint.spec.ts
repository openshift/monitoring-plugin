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

  it('includes metadata by default and when explicitly requested', () => {
    const labels = { alertname: 'TestAlert', openshift_io_alert_backend: 'alertmanager' };
    expect(computeAlertFingerprint(labels)).toBe(computeAlertFingerprint(labels, false));
    expect(computeAlertFingerprint(labels)).not.toBe(
      computeAlertFingerprint({ alertname: 'TestAlert' }),
    );
  });

  it.each([
    'openshift_io_alert_backend',
    'openshift_io_alert_rule_id',
    'openshift_io_alert_source',
    'openshift_io_prometheus_rule_namespace',
    'openshift_io_prometheus_rule_name',
    'openshift_io_alerting_rule_name',
    'openshift_io_rule_managed_by',
    'openshift_io_relabel_config_managed_by',
    'openshift_io_alert_rule_component',
    'openshift_io_alert_rule_layer',
    'openshift_io_alert_rule_component_from',
    'openshift_io_alert_rule_layer_from',
    'openshift_io_alert_rule_classification_managed_by',
  ])('ignores %s only when metadata filtering is enabled', (name) => {
    const labels = { alertname: 'TestAlert', [name]: 'metadata' };
    const expected = computeAlertFingerprint({ alertname: 'TestAlert' });
    expect(computeAlertFingerprint(labels, true)).toBe(expected);
    expect(computeAlertFingerprint(labels)).not.toBe(expected);
  });

  it('retains unlisted openshift_io labels when ignoring metadata', () => {
    const labels = { alertname: 'TestAlert', openshift_io_custom_identity: 'instance-1' };
    expect(computeAlertFingerprint(labels, true)).toBe(computeAlertFingerprint(labels));
    expect(computeAlertFingerprint(labels, true)).not.toBe(
      computeAlertFingerprint({ alertname: 'TestAlert' }),
    );
    expect(computeAlertFingerprint(labels, true)).not.toBe(
      computeAlertFingerprint({ ...labels, openshift_io_custom_identity: 'instance-2' }, true),
    );
  });

  it('ignores metadata independently of insertion order without changing the input', () => {
    const labels = {
      pod: 'pod-1',
      openshift_io_alert_backend: 'alertmanager',
      alertname: 'TestAlert',
    };
    const original = { ...labels };
    expect(computeAlertFingerprint(labels, true)).toBe(
      computeAlertFingerprint({ alertname: 'TestAlert', pod: 'pod-1' }),
    );
    expect(labels).toEqual(original);
  });

  it('returns the empty-label fingerprint for metadata-only labels when filtering', () => {
    expect(computeAlertFingerprint({ openshift_io_alert_backend: 'alertmanager' }, true)).toBe(
      computeAlertFingerprint({}),
    );
  });
});
