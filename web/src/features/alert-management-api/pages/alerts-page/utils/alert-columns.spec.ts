import {
  defaultAlertColumns,
  parseAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';

describe('parseAlertColumns', () => {
  it.each([
    null,
    '',
    'invalid',
    '{}',
    'null',
    'true',
    '[]',
    '["source"]',
    '["name","source"]',
    '["severity","source"]',
    '["name","severity","unknown"]',
    '["name","severity",null]',
    '["name","severity",1]',
  ])('uses defaults for %s', (value) => {
    expect(parseAlertColumns(value)).toEqual(defaultAlertColumns);
  });

  it('preserves display order and removes duplicate keys', () => {
    expect(parseAlertColumns('["severity","namespace","name","severity"]')).toEqual([
      'severity',
      'namespace',
      'name',
    ]);
  });

  it('accepts only the required columns', () => {
    expect(parseAlertColumns('["severity","name"]')).toEqual(['severity', 'name']);
  });
});
