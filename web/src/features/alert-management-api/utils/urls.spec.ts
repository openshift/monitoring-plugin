import { testAlerts } from '@/features/alert-management-api/tests/fixtures/alerts-test-data';
import {
  getAlertDetailsSearch,
  getAlertRuleDetailsSearch,
  getAlertRuleDetailsUrl,
  getCreateSilenceUrl,
  getSilencesPageUrl,
  silencesPath,
} from '@/features/alert-management-api/utils/urls';
import { computeAlertFingerprint } from '@/shared/utils/alerts/alert-fingerprint';

const alert = testAlerts[0];

it('builds blank silence create links', () => {
  expect(getCreateSilenceUrl()).toBe(`${silencesPath}/~new`);
  expect(getCreateSilenceUrl({})).toBe(`${silencesPath}/~new`);
});

it('carries the saved silence ID on the v2 silences page', () => {
  const silenceID = 'id / ? # &';
  const url = new URL(getSilencesPageUrl(silenceID), 'https://console.example.com');
  expect(url.pathname).toBe(silencesPath);
  expect(url.searchParams.get('silenceID')).toBe(silenceID);
});

it('preserves table state and replaces the selected alert', () => {
  const params = new URLSearchParams(
    getAlertDetailsSearch('?name=Test&aggregate=0&alertRuleID=old&alertID=old', alert),
  );
  expect(params.get('name')).toBe('Test');
  expect(params.get('aggregate')).toBe('0');
  expect(params.getAll('alertRuleID')).toEqual([alert.rule.id]);
  expect(params.getAll('alertID')).toEqual([computeAlertFingerprint(alert.labels)]);
});

it('preserves rule table state but removes alert selection when selecting a rule', () => {
  const params = new URLSearchParams(
    getAlertRuleDetailsSearch('?name=Test&alertRuleID=old&alertID=old', alert.rule),
  );
  expect(params.get('name')).toBe('Test');
  expect(params.getAll('alertRuleID')).toEqual([alert.rule.id]);
  expect(params.has('alertID')).toBe(false);
});

it('links to the new alert rules table with an encoded rule ID', () => {
  const id = 'rule/with spaces?&=#';
  const url = new URL(getAlertRuleDetailsUrl({ id }), 'https://console.example.com');
  expect(url.pathname).toBe('/monitoring/v2/management/alertrules');
  expect([...url.searchParams]).toEqual([['alertRuleID', id]]);
});
