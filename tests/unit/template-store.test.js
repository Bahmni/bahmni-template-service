import path from 'path';
import { fileURLToPath } from 'url';
import TemplateStore from '../../src/services/template-store.js';
import { TemplateNotFoundError } from '../../src/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '..', '..', 'config', 'print-templates');

let store;

beforeEach(() => {
  store = new TemplateStore(fixturesDir);
});

describe('TemplateStore.list', () => {
  test('returns only enabled templates with id, name, description', () => {
    const templates = store.list();
    expect(templates.length).toBeGreaterThanOrEqual(2);
    for (const t of templates) {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('name');
      expect(t).toHaveProperty('description');
      expect(t).not.toHaveProperty('folder');
    }
  });
});

describe('TemplateStore.get', () => {
  test('loads passthrough template (no sources, no computed)', () => {
    const t = store.get('REG_CARD_V1');
    expect(t.templateHtml).toContain('{% extends');
    expect(t.dataConfig).toEqual({});
    expect(t.computedSource).toBeNull();
    expect(t.meta.paperSize).toBe('A5');
    expect(t.meta.orientation).toBe('landscape');
  });

  test('loads fetch template (sources + computed.js)', () => {
    const t = store.get('DISCHARGE_SUMMARY_V1');
    expect(t.dataConfig.sources).toBeDefined();
    expect(Object.keys(t.dataConfig.sources).length).toBeGreaterThan(0);
    expect(t.computedSource).toContain('module.exports');
    expect(t.meta.paperSize).toBe('A4');
  });

  test('throws TemplateNotFoundError for unknown templateId', () => {
    expect(() => store.get('NONEXISTENT')).toThrow(TemplateNotFoundError);
  });
});
