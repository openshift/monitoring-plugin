import { formatCsv } from '@/shared/utils/csv';

describe('formatCsv', () => {
  it('quotes text values and leaves numeric values unquoted', () => {
    expect(
      formatCsv([
        ['Name', 'Count', 'Numeric string'],
        ['Alert1', 2, '3'],
      ]),
      'CSV output should quote text and leave numeric values unquoted',
    ).toBe('"Name","Count","Numeric string"\n"Alert1",2,3');
  });

  it('uses the requested delimiter', () => {
    expect(
      formatCsv([['Name', 'Count']], ';'),
      'CSV output should separate values with the requested delimiter',
    ).toBe('"Name";"Count"');
  });

  it('handles missing tables and rows', () => {
    expect(formatCsv(undefined), 'A missing table should remain undefined').toBeUndefined();
    expect(formatCsv([['Name'], undefined]), 'A missing row should produce an empty CSV row').toBe(
      '"Name"\n',
    );
  });
});
