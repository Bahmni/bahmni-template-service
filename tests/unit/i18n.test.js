import path from 'path';
import { fileURLToPath } from 'url';
import I18n from '../../src/services/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, '..', '..', 'config', 'print-templates', '_i18n');

let i18n;

beforeEach(() => {
  i18n = new I18n(i18nDir, 'en');
});

describe('I18n.resolve', () => {
  test('returns the requested locale when available', () => {
    expect(i18n.resolve('fr')).toBe('fr');
  });

  test('falls back to default locale for unknown locale', () => {
    expect(i18n.resolve('xx')).toBe('en');
  });
});

describe('I18n.createFilter', () => {
  test('looks up key using context locale', () => {
    const filter = i18n.createFilter();
    const result = filter.call({ ctx: { locale: 'fr' } }, 'patient_name');
    expect(result).toBe('Nom du Patient');
  });

  test('locale override bypasses context locale', () => {
    const filter = i18n.createFilter();
    const result = filter.call({ ctx: { locale: 'en' } }, 'patient_name', 'fr');
    expect(result).toBe('Nom du Patient');
  });

  test('falls back to default locale when key missing in request locale', () => {
    const filter = i18n.createFilter();
    // 'en' has 'patient_name', simulate a locale that doesn't
    const result = filter.call({ ctx: { locale: 'xx' } }, 'patient_name');
    expect(result).toBe('Patient Name');
  });

  test('returns key itself if no translation found anywhere', () => {
    const filter = i18n.createFilter();
    const result = filter.call({ ctx: { locale: 'en' } }, 'nonexistent_key');
    expect(result).toBe('nonexistent_key');
  });
});
