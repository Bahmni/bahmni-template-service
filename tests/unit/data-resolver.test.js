import { interpolate, buildUrl } from '../../src/services/data-resolver.js';

describe('interpolate', () => {
  test('replaces placeholders with context values', () => {
    expect(interpolate('{{patientUuid}}', { patientUuid: 'abc-123' }))
      .toBe('abc-123');
  });

  test('replaces missing keys with empty string', () => {
    expect(interpolate('{{missing}}', {})).toBe('');
  });
});

describe('buildUrl', () => {
  const context = { patientUuid: 'abc-123', visitUuid: 'def-456' };

  test('builds FHIR single resource URL', () => {
    const url = buildUrl(
      { api: 'fhir', resource: 'Patient', params: { id: '{{patientUuid}}' } },
      context
    );
    expect(url).toContain('/openmrs/ws/fhir2/R4/Patient/abc-123');
  });

  test('builds FHIR search URL with query params', () => {
    const url = buildUrl(
      { api: 'fhir', resource: 'Encounter', params: { subject: '{{patientUuid}}', visit: '{{visitUuid}}' } },
      context
    );
    expect(url).toContain('/openmrs/ws/fhir2/R4/Encounter?');
    expect(url).toContain('subject=abc-123');
    expect(url).toContain('visit=def-456');
  });

  test('builds REST URL with interpolated endpoint', () => {
    const url = buildUrl(
      { api: 'rest', endpoint: '/obs?patient={{patientUuid}}&conceptClass=Vitals' },
      context
    );
    expect(url).toContain('/openmrs/ws/rest/v1/obs?patient=abc-123&conceptClass=Vitals');
  });

  test('throws for unknown API type', () => {
    expect(() => buildUrl({ api: 'graphql' }, context)).toThrow(/Unknown API type/);
  });
});
