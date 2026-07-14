import { localeCompareSort, directedSort } from './sort-utils';

describe('localeCompareSort', () => {
  it('should return negative when a < b in asc', () => {
    expect(localeCompareSort('apple', 'banana', 'asc')).toBeLessThan(0);
  });

  it('should return positive when a > b in asc', () => {
    expect(localeCompareSort('banana', 'apple', 'asc')).toBeGreaterThan(0);
  });

  it('should return 0 for equal strings', () => {
    expect(localeCompareSort('same', 'same', 'asc')).toBe(0);
    expect(localeCompareSort('same', 'same', 'desc')).toBe(0);
  });

  it('should reverse order for desc', () => {
    expect(localeCompareSort('apple', 'banana', 'desc')).toBeGreaterThan(0);
    expect(localeCompareSort('banana', 'apple', 'desc')).toBeLessThan(0);
  });

  it('should be case insensitive', () => {
    expect(localeCompareSort('Apple', 'apple', 'asc')).toBe(0);
    expect(localeCompareSort('ABC', 'abc', 'asc')).toBe(0);
  });

  it('should treat null as empty string', () => {
    expect(localeCompareSort(null, 'a', 'asc')).toBeLessThan(0);
    expect(localeCompareSort('a', null, 'asc')).toBeGreaterThan(0);
    expect(localeCompareSort(null, null, 'asc')).toBe(0);
  });

  it('should treat undefined as empty string', () => {
    expect(localeCompareSort(undefined, 'a', 'asc')).toBeLessThan(0);
    expect(localeCompareSort('a', undefined, 'asc')).toBeGreaterThan(0);
    expect(localeCompareSort(undefined, undefined, 'asc')).toBe(0);
  });
});

describe('directedSort', () => {
  it('should preserve sign for asc', () => {
    expect(directedSort(-1, 'asc')).toBe(-1);
    expect(directedSort(1, 'asc')).toBe(1);
    expect(directedSort(0, 'asc')).toBe(0);
  });

  it('should flip sign for desc', () => {
    expect(directedSort(-1, 'desc')).toBe(1);
    expect(directedSort(1, 'desc')).toBe(-1);
    expect(directedSort(0, 'desc')).toBe(0);
  });

  it('should work with arbitrary numeric values', () => {
    expect(directedSort(42, 'asc')).toBe(42);
    expect(directedSort(42, 'desc')).toBe(-42);
  });
});
