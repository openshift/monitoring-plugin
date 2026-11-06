import { parseTableColumns } from '@/features/alert-management-api/utils/table-columns';

const definitions = [{ key: 'name' }, { key: 'state' }, { key: 'creator' }] as const;
const defaults = ['name', 'state'] as const;

it.each([
  null,
  '',
  'null',
  '{}',
  'true',
  'bad json',
  '[]',
  '["state"]',
  '["name","old"]',
  '["name",1]',
  '["name",null]',
])('uses defaults for invalid columns %s', (value) => {
  expect(
    parseTableColumns(value, definitions, [...defaults], ['name']),
    `Invalid column configuration ${String(value)} should use defaults`,
  ).toEqual(defaults);
});

it('preserves user order while deduplicating known columns', () => {
  expect(
    parseTableColumns('["creator","name","creator"]', definitions, [...defaults], ['name']),
    'Duplicate columns should be removed without changing their order',
  ).toEqual(['creator', 'name']);
});

it.each(['["name"]', '["state"]', '["name","creator"]', '["state","creator"]'])(
  'uses defaults when any required column is missing from %s',
  (value) => {
    expect(
      parseTableColumns(value, definitions, [...defaults], ['name', 'state']),
      `Configuration ${value} should use defaults when any required column is missing`,
    ).toEqual(defaults);
  },
);

it('preserves display order and deduplicates with multiple required columns', () => {
  expect(
    parseTableColumns(
      '["state","creator","name","state"]',
      definitions,
      [...defaults],
      ['name', 'state'],
    ),
    'Deduplication should preserve display order when multiple columns are required',
  ).toEqual(['state', 'creator', 'name']);
});

it('accepts only the required columns in the configured order', () => {
  expect(
    parseTableColumns('["state","name"]', definitions, [...defaults], ['name', 'state']),
    'Required columns should retain their configured order without adding optional columns',
  ).toEqual(['state', 'name']);
});
