import { formatSilenceDate, padNumber } from '@/shared/utils/date';

describe('date formatting', () => {
  it('pads numbers to two digits', () => {
    expect(padNumber(0)).toBe('00');
    expect(padNumber(7)).toBe('07');
    expect(padNumber(12)).toBe('12');
  });

  it('formats silence dates with padded date and time fields', () => {
    expect(formatSilenceDate(new Date(2026, 8, 3, 4, 5, 6))).toBe('2026/09/03 04:05:06');
  });
});
