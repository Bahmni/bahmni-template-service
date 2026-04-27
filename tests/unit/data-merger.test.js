import { inferMode, merge } from '../../src/services/data-merger.js';

describe('inferMode', () => {
  test('passthrough: no sources + data', () => {
    expect(inferMode({}, { patient: {} })).toBe('passthrough');
  });

  test('fetch: sources + no data', () => {
    expect(inferMode({ sources: { patient: {} } }, null)).toBe('fetch');
  });

  test('hybrid: sources + data', () => {
    expect(inferMode({ sources: { patient: {} } }, { vitals: [] })).toBe('hybrid');
  });
});

describe('merge', () => {
  test('client data overrides fetched data on conflict', () => {
    const fetched = { patient: { name: 'Fetched' }, vitals: [1] };
    const client = { vitals: [2, 3] };
    const result = merge(fetched, client);
    expect(result.patient.name).toBe('Fetched');
    expect(result.vitals).toEqual([2, 3]);
  });

  test('combines non-overlapping keys', () => {
    const result = merge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });
});
