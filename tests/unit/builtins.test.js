import builtins, {
  age, ageFilter, dateFormat, dateDiff,
  numberFormat, capitalize, truncate,
  groupBy, sortBy, take, get,
} from '../../src/utils/builtins.js';

describe('age', () => {
  test('calculates correct age components', () => {
    const result = age('1980-06-15', '2026-04-10');
    expect(result.years).toBe(45);
    expect(result.months).toBe(9);
    expect(result.display).toBe('45y 9m 26d');
    expect(result.short).toBe('45y');
    expect(result.totalMonths).toBe(45 * 12 + 9);
  });

  test('returns null for null/invalid input', () => {
    expect(age(null)).toBeNull();
    expect(age('not-a-date')).toBeNull();
  });

  test('toString returns display string', () => {
    const result = age('1980-06-15', '2026-04-10');
    expect(`${result}`).toBe('45y 9m 26d');
  });
});

describe('ageFilter', () => {
  test('returns display by default, short/years on request', () => {
    expect(ageFilter('1980-06-15', 'short')).toMatch(/^\d+y$/);
    expect(typeof ageFilter('1980-06-15', 'years')).toBe('number');
    expect(ageFilter(null)).toBe('');
  });
});

describe('dateFormat', () => {
  test('formats date in ISO mode', () => {
    expect(dateFormat('2026-04-09T10:00:00Z', 'en', 'iso')).toBe('2026-04-09');
  });

  test('returns empty string for falsy input', () => {
    expect(dateFormat(null)).toBe('');
    expect(dateFormat('')).toBe('');
  });

  test('returns original string for invalid date', () => {
    expect(dateFormat('garbage')).toBe('garbage');
  });
});

describe('dateDiff', () => {
  test('calculates days between two dates', () => {
    expect(dateDiff('2026-04-01', '2026-04-06')).toBe(5);
  });

  test('calculates hours', () => {
    expect(dateDiff('2026-04-01T00:00:00Z', '2026-04-01T12:00:00Z', 'hours')).toBe(12);
  });

  test('returns null for missing dates', () => {
    expect(dateDiff(null, '2026-04-06')).toBeNull();
  });
});

describe('numberFormat', () => {
  test('formats with decimals', () => {
    expect(numberFormat(1234.5, 'en', 2)).toBe('1,234.50');
  });

  test('returns empty for null/undefined', () => {
    expect(numberFormat(null)).toBe('');
    expect(numberFormat(undefined)).toBe('');
  });
});

describe('capitalize', () => {
  test('capitalizes first letter', () => {
    expect(capitalize('hello world')).toBe('Hello world');
  });

  test('handles empty/null', () => {
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
  });
});

describe('truncate', () => {
  test('truncates long strings', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde...');
  });

  test('leaves short strings intact', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
});

describe('collection utils', () => {
  const items = [
    { name: 'B', category: 'X', score: 2 },
    { name: 'A', category: 'Y', score: 1 },
    { name: 'C', category: 'X', score: 3 },
  ];

  test('sortBy ascending and descending', () => {
    expect(sortBy(items, 'score')[0].name).toBe('A');
    expect(sortBy(items, 'score', 'desc')[0].name).toBe('C');
  });

  test('groupBy groups correctly', () => {
    const grouped = groupBy(items, 'category');
    expect(grouped['X']).toHaveLength(2);
    expect(grouped['Y']).toHaveLength(1);
  });

  test('take returns first N items', () => {
    expect(take(items, 2)).toHaveLength(2);
    expect(take(null, 2)).toEqual([]);
  });

  test('get resolves nested paths', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(get(obj, 'a.b.c')).toBe(42);
    expect(get(obj, 'a.x.y')).toBeUndefined();
    expect(get(null, 'a')).toBeUndefined();
  });
});

describe('fhirpath availability', () => {
  test('fhirpath is exposed in builtins with evaluate and compile', () => {
    expect(typeof builtins.fhirpath.evaluate).toBe('function');
    expect(typeof builtins.fhirpath.compile).toBe('function');
  });
});
