import {
  directedSort,
  localeCompareSort,
  makeLabelColumnSorter,
  makeValueColumnSorter,
  naturalSort,
  parsePrometheusValue,
} from '@/shared/components/table/sort-utils';

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

describe('naturalSort', () => {
  it('should sort numeric strings in numeric order, not lexicographic', () => {
    const values = ['10', '2', '1', '20'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['1', '2', '10', '20']);
  });

  it('should sort mixed alphanumeric strings naturally', () => {
    const values = ['file10', 'file1', 'file2'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['file1', 'file2', 'file10']);
  });

  it('should reverse order for desc direction', () => {
    const values = ['1', '10', '2', '20'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'desc'));
    expect(sorted).toEqual(['20', '10', '2', '1']);
  });

  it('should treat null as empty string', () => {
    expect(naturalSort(null, 'a', 'asc')).toBeLessThan(0);
    expect(naturalSort('a', null, 'asc')).toBeGreaterThan(0);
    expect(naturalSort(null, null, 'asc')).toBe(0);
  });

  it('should treat undefined as empty string', () => {
    expect(naturalSort(undefined, 'a', 'asc')).toBeLessThan(0);
    expect(naturalSort('a', undefined, 'asc')).toBeGreaterThan(0);
    expect(naturalSort(undefined, undefined, 'asc')).toBe(0);
  });

  it('should be case insensitive', () => {
    expect(naturalSort('File1', 'file1', 'asc')).toBe(0);
    expect(naturalSort('ABC', 'abc', 'asc')).toBe(0);
  });

  it('should sort pure alphabetic strings correctly', () => {
    const values = ['cherry', 'apple', 'banana'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['apple', 'banana', 'cherry']);
  });

  it('should sort Prometheus histogram le labels numerically (asc)', () => {
    const values = ['+Inf', '10.0', '0.1', '0.01', '0.001', '1.0', '60.0', '120.0'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['0.001', '0.01', '0.1', '1.0', '10.0', '60.0', '120.0', '+Inf']);
  });

  it('should sort Prometheus histogram le labels numerically (desc)', () => {
    const values = ['+Inf', '10.0', '0.1', '0.01', '0.001', '1.0', '60.0', '120.0'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'desc'));
    expect(sorted).toEqual(['+Inf', '120.0', '60.0', '10.0', '1.0', '0.1', '0.01', '0.001']);
  });

  it('should place +Inf after all numbers in asc and first in desc', () => {
    expect(naturalSort('+Inf', '999999', 'asc')).toBeGreaterThan(0);
    expect(naturalSort('+Inf', '999999', 'desc')).toBeLessThan(0);
    expect(naturalSort('-Inf', '0', 'asc')).toBeLessThan(0);
    expect(naturalSort('-Inf', '0', 'desc')).toBeGreaterThan(0);
  });

  it('should sort NaN last in both directions', () => {
    expect(naturalSort('NaN', '0', 'asc')).toBeGreaterThan(0);
    expect(naturalSort('NaN', '0', 'desc')).toBeGreaterThan(0);
    expect(naturalSort('0', 'NaN', 'asc')).toBeLessThan(0);
    expect(naturalSort('0', 'NaN', 'desc')).toBeLessThan(0);
    expect(naturalSort('NaN', 'NaN', 'asc')).toBe(0);
    expect(naturalSort('NaN', '+Inf', 'asc')).toBeGreaterThan(0);
    expect(naturalSort('NaN', '+Inf', 'desc')).toBeGreaterThan(0);
  });

  it('should place numeric values before non-numeric values in a fixed direction-independent order', () => {
    // "10" is numeric, "file10" is non-numeric — numeric comes first regardless of direction
    expect(naturalSort('10', 'file10', 'asc')).toBeLessThan(0);
    expect(naturalSort('10', 'file10', 'desc')).toBeLessThan(0);
    expect(naturalSort('file10', '10', 'asc')).toBeGreaterThan(0);
    expect(naturalSort('file10', '10', 'desc')).toBeGreaterThan(0);
    // +Inf is numeric, "unknown" is non-numeric
    expect(naturalSort('+Inf', 'unknown', 'asc')).toBeLessThan(0);
    expect(naturalSort('+Inf', 'unknown', 'desc')).toBeLessThan(0);
  });

  it('should sort all Prometheus special values together correctly (asc)', () => {
    const values = ['NaN', '+Inf', '10', '-Inf', '0', '1'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['-Inf', '0', '1', '10', '+Inf', 'NaN']);
  });

  it('should sort all Prometheus special values together correctly (desc)', () => {
    const values = ['NaN', '+Inf', '10', '-Inf', '0', '1'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'desc'));
    expect(sorted).toEqual(['+Inf', '10', '1', '0', '-Inf', 'NaN']);
  });

  it('should sort version strings naturally via localeCompare fallback', () => {
    const values = ['v1.10.0', 'v1.2.0', 'v1.9.0', 'v2.0.0'];
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['v1.2.0', 'v1.9.0', 'v1.10.0', 'v2.0.0']);
  });
});

describe('parsePrometheusValue', () => {
  it('should parse +Inf to Infinity', () => {
    expect(parsePrometheusValue('+Inf')).toBe(Infinity);
  });

  it('should parse -Inf to -Infinity', () => {
    expect(parsePrometheusValue('-Inf')).toBe(-Infinity);
  });

  it('should parse NaN string to JS NaN', () => {
    expect(Number.isNaN(parsePrometheusValue('NaN'))).toBe(true);
  });

  it('should parse numeric strings correctly', () => {
    expect(parsePrometheusValue('0.001')).toBe(0.001);
    expect(parsePrometheusValue('120')).toBe(120);
    expect(parsePrometheusValue('1.5e+08')).toBe(1.5e8);
  });

  it('should coerce non-string inputs via String()', () => {
    expect(parsePrometheusValue(42)).toBe(42);
    expect(parsePrometheusValue(null)).toBeNaN();
  });
});

describe('makeValueColumnSorter', () => {
  // Rows: [label, value]. colIndex=1 is the value column.
  const rows = [
    ['a', '10'],
    ['b', '1'],
    ['c', '100'],
    ['d', '2'],
  ];

  it('sorts numerically asc', () => {
    const sorted = [...rows].sort(makeValueColumnSorter(1, 'asc'));
    expect(sorted.map((r) => r[1])).toEqual(['1', '2', '10', '100']);
  });

  it('sorts numerically desc', () => {
    const sorted = [...rows].sort(makeValueColumnSorter(1, 'desc'));
    expect(sorted.map((r) => r[1])).toEqual(['100', '10', '2', '1']);
  });

  it('places -Inf first in asc and last in desc', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', '-Inf'], ['b', '0'])).toBeLessThan(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', '-Inf'], ['b', '0'])).toBeGreaterThan(0);
  });

  it('places +Inf last in asc (before NaN) and first in desc', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', '+Inf'], ['b', '999'])).toBeGreaterThan(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', '+Inf'], ['b', '999'])).toBeLessThan(0);
  });

  it('sorts NaN last in both asc and desc', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', 'NaN'], ['b', '0'])).toBeGreaterThan(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', 'NaN'], ['b', '0'])).toBeGreaterThan(0);
    expect(makeValueColumnSorter(1, 'asc')(['a', '0'], ['b', 'NaN'])).toBeLessThan(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', '0'], ['b', 'NaN'])).toBeLessThan(0);
  });

  it('two NaN rows compare as equal', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', 'NaN'], ['b', 'NaN'])).toBe(0);
  });

  it('two +Inf rows compare as equal (guards against Infinity - Infinity = NaN)', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', '+Inf'], ['b', '+Inf'])).toBe(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', '+Inf'], ['b', '+Inf'])).toBe(0);
  });

  it('two -Inf rows compare as equal', () => {
    expect(makeValueColumnSorter(1, 'asc')(['a', '-Inf'], ['b', '-Inf'])).toBe(0);
    expect(makeValueColumnSorter(1, 'desc')(['a', '-Inf'], ['b', '-Inf'])).toBe(0);
  });

  it('respects the given column index', () => {
    // colIndex=0: sort by first column
    const colZeroRows = [
      ['10', 'z'],
      ['1', 'a'],
      ['100', 'm'],
    ];
    const sorted = [...colZeroRows].sort(makeValueColumnSorter(0, 'asc'));
    expect(sorted.map((r) => r[0])).toEqual(['1', '10', '100']);
  });
});

describe('makeLabelColumnSorter', () => {
  // Rows: [value, label]. colIndex=1 is the label column.
  it('sorts label strings with natural numeric collation in asc order', () => {
    const rows = [
      ['1', 'replica-10'],
      ['1', 'replica-2'],
      ['1', 'replica-1'],
      ['1', 'replica-20'],
    ];
    const sorted = [...rows].sort(makeLabelColumnSorter(1, 'asc'));
    expect(sorted.map((r) => r[1])).toEqual(['replica-1', 'replica-2', 'replica-10', 'replica-20']);
  });

  it('sorts label strings with natural numeric collation in desc order', () => {
    const rows = [
      ['1', 'replica-10'],
      ['1', 'replica-2'],
      ['1', 'replica-1'],
      ['1', 'replica-20'],
    ];
    const sorted = [...rows].sort(makeLabelColumnSorter(1, 'desc'));
    expect(sorted.map((r) => r[1])).toEqual(['replica-20', 'replica-10', 'replica-2', 'replica-1']);
  });

  it('places numeric labels before non-numeric labels regardless of direction', () => {
    const rows = [
      ['1', 'critical'],
      ['1', '10'],
      ['1', 'high'],
      ['1', '2'],
    ];
    const asc = [...rows].sort(makeLabelColumnSorter(1, 'asc'));
    const desc = [...rows].sort(makeLabelColumnSorter(1, 'desc'));
    // numeric labels (2, 10) always cluster before non-numeric (critical, high)
    expect(asc.map((r) => r[1])).toEqual(['2', '10', 'critical', 'high']);
    expect(desc.map((r) => r[1])).toEqual(['10', '2', 'high', 'critical']);
  });

  it('sorts pure numeric labels numerically, not lexicographically', () => {
    const rows = [
      ['1', '10'],
      ['1', '2'],
      ['1', '1'],
      ['1', '20'],
    ];
    const sorted = [...rows].sort(makeLabelColumnSorter(1, 'asc'));
    expect(sorted.map((r) => r[1])).toEqual(['1', '2', '10', '20']);
  });

  it('respects the given column index', () => {
    // colIndex=0: sort by first column
    const rows = [
      ['file10', '1'],
      ['file2', '1'],
      ['file1', '1'],
    ];
    const sorted = [...rows].sort(makeLabelColumnSorter(0, 'asc'));
    expect(sorted.map((r) => r[0])).toEqual(['file1', 'file2', 'file10']);
  });

  it('coerces undefined/null cells to empty string', () => {
    const rows = [
      [undefined, '1'],
      ['b', '1'],
      [null, '1'],
    ];
    expect(() => [...rows].sort(makeLabelColumnSorter(0, 'asc'))).not.toThrow();
  });
});

// Rows: [label, metric_value]. colIndex=1 is the value column.
// Labels starting with M sit alphabetically before "NaN", labels starting with O after.
describe('makeValueColumnSorter — NaN rows always sort last regardless of direction', () => {
  const rows = [
    ['Mercury', '0.42'], // numeric, M-word
    ['Mimosa', 'NaN'], // NaN value, M-word — would naturally precede O-words alphabetically
    ['Mizar', '-Inf'], // numeric (-Inf), M-word
    ['Orion', '12.5'], // numeric, O-word
    ['Ophiuchus', '+Inf'], // numeric (+Inf), O-word
  ];

  it('asc: -Inf → 0.42 → 12.5 → +Inf → NaN (Mimosa last despite M coming before O)', () => {
    const sorted = [...rows].sort(makeValueColumnSorter(1, 'asc'));
    // -Inf      0.42     12.5          +Inf      NaN
    expect(sorted.map((r) => r[0])).toEqual(['Mizar', 'Mercury', 'Orion', 'Ophiuchus', 'Mimosa']);
  });

  it('desc: +Inf → 12.5 → 0.42 → -Inf → NaN (Mimosa last despite M coming before O)', () => {
    const sorted = [...rows].sort(makeValueColumnSorter(1, 'desc'));
    expect(sorted.map((r) => r[0])).toEqual(['Ophiuchus', 'Orion', 'Mercury', 'Mizar', 'Mimosa']);
    //                                                     +Inf    12.5       0.42     -Inf     NaN
  });

  it('two NaN rows compare as equal', () => {
    const nanRows = [
      ['Mimosa', 'NaN'],
      ['Mizar', 'NaN'],
    ];
    expect(makeValueColumnSorter(1, 'asc')(nanRows[0], nanRows[1])).toBe(0);
  });
});

// naturalSort is used for label columns. "NaN" as a label string is non-numeric, so it
// clusters with other non-numeric strings and sorts alphabetically among them.
// M-words sort before "NaN" (M < N) and O-words sort after (N < O), making the
// NaN position in the sorted list easy to spot.
describe('naturalSort (label column) — NaN string sorts alphabetically among non-numerics', () => {
  const values = ['Orion', '1.5', 'Mercury', 'NaN', '0.5', 'Ophiuchus', 'Mimosa', '10'];

  it('asc: numerics cluster first (ascending), then non-numerics A→Z; NaN sits between M-words and O-words', () => {
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'asc'));
    expect(sorted).toEqual(['0.5', '1.5', '10', 'Mercury', 'Mimosa', 'NaN', 'Ophiuchus', 'Orion']);
  });

  it('desc: numerics cluster first (descending), then non-numerics Z→A; NaN sits between O-words and M-words', () => {
    const sorted = [...values].sort((a, b) => naturalSort(a, b, 'desc'));
    expect(sorted).toEqual(['10', '1.5', '0.5', 'Orion', 'Ophiuchus', 'NaN', 'Mimosa', 'Mercury']);
  });

  it('NaN position is direction-independent when mixed with a numeric: numeric always comes first', () => {
    expect(naturalSort('NaN', '0', 'asc')).toBeGreaterThan(0);
    expect(naturalSort('NaN', '0', 'desc')).toBeGreaterThan(0);
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
