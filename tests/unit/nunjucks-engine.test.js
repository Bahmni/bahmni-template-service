import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import NunjucksEngine from '../../src/services/nunjucks-engine.js';
import I18n from '../../src/services/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(__dirname, '..', '..', 'config', 'print-templates');
const fixtureDir = path.join(__dirname, '..', 'fixtures', 'nunjucks');
const i18nDir = path.join(templatesDir, '_i18n');

beforeAll(() => {
  fs.mkdirSync(fixtureDir, { recursive: true });

  fs.writeFileSync(path.join(fixtureDir, 'base.html'),
    '<html>{% block content %}{% endblock %}</html>');

  fs.writeFileSync(path.join(fixtureDir, 'child.html'),
    '{% extends "base.html" %}{% block content %}Hello {{ name }}{% endblock %}');

  fs.writeFileSync(path.join(fixtureDir, 'filters.html'),
    '{{ birthDate | age }} | {{ val | numberFormat("en", 2) }}');
});

describe('NunjucksEngine', () => {
  test('template inheritance and variable substitution', () => {
    const engine = new NunjucksEngine(fixtureDir);
    const html = engine.render('child.html', { name: 'World' });
    expect(html).toBe('<html>Hello World</html>');
  });

  test('builtin filters work in templates', () => {
    const engine = new NunjucksEngine(fixtureDir);
    const html = engine.render('filters.html', {
      birthDate: '1980-06-15',
      val: 1234.5,
    });
    expect(html).toMatch(/\d+y \d+m \d+d/);
    expect(html).toContain('1,234.50');
  });

  test('renders real template with i18n and barcode filters', async () => {
    const i18n = new I18n(i18nDir, 'en');
    const engine = new NunjucksEngine(templatesDir, i18n);

    const html = await engine.renderAsync('registration-card/template.html', {
      locale: 'en',
      patient: {
        uuid: 'test-uuid',
        identifier: 'BAH123',
        name: 'Test Patient',
        gender: 'Male',
        birthDate: '1990-01-01',
        address: '123 Street',
        registrationDate: '2026-04-01',
      },
      facility: { name: 'Test Hospital' },
      now: new Date().toISOString(),
    });

    expect(html).toContain('Test Patient');
    expect(html).toContain('BAH123');
    expect(html).toContain('data:image/png;base64,'); // real barcode generated
  });

  test('fhirpathEvaluate filter is available', () => {
    const engine = new NunjucksEngine(fixtureDir);
    fs.writeFileSync(path.join(fixtureDir, 'fp.html'),
      '{{ patient | fhirpathEvaluate("Patient.name.given") }}');
    const html = engine.render('fp.html', {
      patient: { resourceType: 'Patient', name: [{ given: ['John'] }] },
    });
    expect(html).toContain('John');
  });
});
