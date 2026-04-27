import { generateBarcode, generateQrcode } from '../../src/services/barcode.js';

describe('generateBarcode', () => {
  test('returns base64 data URI for valid input', async () => {
    const result = await generateBarcode('ABC123', 'code128', 30);
    expect(result).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  });

  test('returns empty string for null/empty value', async () => {
    expect(await generateBarcode(null)).toBe('');
    expect(await generateBarcode('')).toBe('');
  });
});

describe('generateQrcode', () => {
  test('returns base64 data URI for valid input', async () => {
    const result = await generateQrcode('some-uuid-value', 150);
    expect(result).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  });

  test('returns empty string for null value', async () => {
    expect(await generateQrcode(null)).toBe('');
  });
});
