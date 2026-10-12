import { formatCsv } from '@/shared/utils/csv';

describe('formatCsv', () => {
  it('prefixes every cell, including numeric values', () => {
    expect(
      formatCsv([
        [`Name`, `Count`, `Numeric string`],
        [`Alert1`, 2, `3`],
      ]),
      'CSV output should prefix all values and quote them',
    ).toBe(`"'Name","'Count","'Numeric string"\n"'Alert1","'2","'3"`);
  });

  it('uses the requested delimiter', () => {
    expect(
      formatCsv([[`Name`, `Count`]], `;`),
      'CSV output should separate values with the requested delimiter',
    ).toBe(`"'Name";"'Count"`);
  });

  it('handles missing tables and rows', () => {
    expect(formatCsv(undefined), 'A missing table should remain undefined').toBeUndefined();
    expect(formatCsv([[`Name`], undefined]), 'A missing row should produce an empty CSV row').toBe(
      `"'Name"\n`,
    );
    expect(formatCsv([[``, null, undefined]])).toBe(`"'","'","'"`);
  });

  it('prefixes formula values and escapes embedded quotes without breaking CSV cells', () => {
    expect(
      formatCsv([
        [`=1+2`, `+1+2`, `-1+2`, `@SUM(A1)`, `\t=1+2`, `\r=1+2`, `"=1+2`],
        [`hello,=1+2`, `a"b`, `a\nb`, -2],
      ]),
    ).toBe(
      `"'=1+2","'+1+2","'-1+2","'@SUM(A1)","'\t=1+2","'\r=1+2","'""=1+2"\n` +
        `"'hello,=1+2","'a""b","'a\nb","'-2"`,
    );
  });
});
