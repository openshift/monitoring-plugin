import { downloadCsv, formatCsv } from '@/shared/utils/csv';

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

describe('downloadCsv', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads the blob and revokes its URL after a delay', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn().mockReturnValue('blob:csv');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    const link = {
      href: '',
      download: '',
      click: vi.fn(() => {
        expect(link.href, 'The download link should point to the created Blob URL').toBe(
          'blob:csv',
        );
        expect(link.download, 'The download link should use the requested filename').toBe(
          'alerts.csv',
        );
        expect(
          revokeObjectURL,
          'The Blob URL should still be available when clicked',
        ).not.toHaveBeenCalled();
      }),
    };
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(link) });
    const blob = new Blob(['name'], { type: 'text/csv' });

    downloadCsv(blob, 'alerts.csv');

    expect(
      createObjectURL,
      'The download should create an object URL for the given Blob',
    ).toHaveBeenCalledWith(blob);
    expect(
      document.createElement,
      'The download should create an anchor element',
    ).toHaveBeenCalledWith('a');
    expect(link.click, 'The download link should be clicked once').toHaveBeenCalledOnce();
    vi.advanceTimersByTime(59999);
    expect(
      revokeObjectURL,
      'The Blob URL should remain valid before the delay expires',
    ).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(
      revokeObjectURL,
      'The Blob URL should be revoked once after the delay',
    ).toHaveBeenCalledOnce();
    expect(
      revokeObjectURL,
      'Cleanup should revoke the URL created for this download',
    ).toHaveBeenCalledWith('blob:csv');
  });
});
