/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import {
  calculateAge,
  formatDate,
  renderBarcode,
  renderQRCode,
  round,
} from './filters';

const mockToBuffer = jest.fn<Promise<Buffer>, any[]>(
  (jest.requireActual('bwip-js') as any).toBuffer,
);
jest.mock('bwip-js', () => {
  const real = jest.requireActual<typeof import('bwip-js')>('bwip-js');
  return { ...real, toBuffer: (...args: unknown[]) => mockToBuffer(...args) };
});

describe('formatDate', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDate('', 'en')).toBe('');
    expect(formatDate(null as unknown as string, 'en')).toBe('');
  });

  it('returns the original value for an unparseable date string', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('formats a valid date in English locale', () => {
    expect(formatDate('2000-03-05', 'en')).toBe('05 March 2000');
  });

  it('formats a valid date in a non-English locale', () => {
    const result = formatDate('2000-03-05', 'fr');
    expect(result).toMatch(/^05/);
    expect(result).toMatch(/2000$/);
    expect(result).not.toContain('March');
  });
});

describe('calculateAge', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns empty string for falsy input', () => {
    expect(calculateAge('')).toBe('');
    expect(calculateAge(null as unknown as string)).toBe('');
  });

  it('returns empty string for an invalid date', () => {
    expect(calculateAge('not-a-date')).toBe('');
  });

  it('returns days when age is under 30 days', () => {
    expect(calculateAge('2025-01-05')).toBe('10 days');
  });

  it('returns singular day for exactly 1 day', () => {
    expect(calculateAge('2025-01-14')).toBe('1 day');
  });

  it('returns months when age is between 30 days and 24 months', () => {
    expect(calculateAge('2024-06-15')).toBe('7 months');
  });

  it('returns singular month for exactly 1 month', () => {
    expect(calculateAge('2024-12-15')).toBe('1 month');
  });

  it('returns years when age is 24 months or older', () => {
    expect(calculateAge('2020-01-15')).toBe('5 years');
  });

  it('returns years when age is 24 months (2 years)', () => {
    expect(calculateAge('2023-01-15')).toBe('2 years');
  });
});

describe('round', () => {
  it('returns empty string for null', () => {
    expect(round(null as unknown as number)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(round(undefined as unknown as number)).toBe('');
  });

  it('returns empty string for NaN', () => {
    expect(round(NaN)).toBe('');
  });

  it('rounds to 0 decimals by default', () => {
    expect(round(3.7)).toBe('4');
  });

  it('rounds to the specified number of decimals', () => {
    expect(round(3.14159, 2)).toBe('3.14');
  });

  it('handles negative numbers', () => {
    expect(round(-2.5, 1)).toBe('-2.5');
  });
});

describe('renderBarcode', () => {
  it('resolves to a PNG data URL img tag for a valid value', async () => {
    const html = await renderBarcode('ABC-123', 'code128', 40);
    expect(html).toMatch(/<img src="data:image\/png;base64,/);
    const match = html.match(/base64,([A-Za-z0-9+/=]+)"/);
    expect(match).not.toBeNull();
    const buf = Buffer.from(match![1], 'base64');
    expect(buf[0]).toBe(0x89); // PNG magic bytes
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it('uses code128 as default type', async () => {
    const html = await renderBarcode('ABC-123');
    expect(html).toMatch(/<img src="data:image\/png;base64,/);
  });

  it('resolves to a fallback span for an invalid bcid', async () => {
    const html = await renderBarcode('X', 'not-a-real-bcid', 40);
    expect(html).toContain('<span class="barcode-fallback">X</span>');
  });

  it('HTML-escapes the value in the fallback span', async () => {
    const html = await renderBarcode('<script>', 'not-a-real-bcid', 40);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});

describe('renderQRCode', () => {
  it('returns empty string for an empty value', async () => {
    expect(await renderQRCode('')).toBe('');
    expect(await renderQRCode(null as unknown as string)).toBe('');
  });

  it('returns a PNG img tag for a valid value', async () => {
    const result = await renderQRCode('https://example.com');
    expect(result).toMatch(/^<img src="data:image\/png;base64,/);
  });

  it('uses the provided scale', async () => {
    const result = await renderQRCode('test', 5);
    expect(result).toMatch(/^<img src="data:image\/png;base64,/);
  });

  it('falls back to a span when bwip-js throws', async () => {
    mockToBuffer.mockRejectedValueOnce(new Error('forced error'));
    const result = await renderQRCode('<bad>');
    expect(result).toContain('qrcode-fallback');
    expect(result).toContain('&lt;bad&gt;');
  });
});
