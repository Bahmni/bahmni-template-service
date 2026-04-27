import { run } from '../../src/services/computed-runner.js';

describe('ComputedRunner', () => {
  test('executes computed.js and returns derived fields', () => {
    const source = `module.exports = function(data, utils) {
      return { doubled: data.value * 2 };
    };`;
    const result = run(source, { value: 5 });
    expect(result.doubled).toBe(10);
  });

  test('utils are available inside sandbox', () => {
    const source = `module.exports = function(data, utils) {
      return { age: utils.age(data.birthDate, '2026-04-10').years };
    };`;
    const result = run(source, { birthDate: '1980-06-15' });
    expect(result.age).toBe(45);
  });

  test('returns empty object when no source', () => {
    expect(run(null, {})).toEqual({});
  });

  test('no access to require', () => {
    const source = `module.exports = function() {
      return { fs: typeof require };
    };`;
    const result = run(source, {});
    expect(result.fs).toBe('undefined');
  });

  test('timeout enforced on infinite loop', () => {
    const source = `module.exports = function() {
      while(true) {}
    };`;
    expect(() => run(source, {})).toThrow();
  });

  test('runs real discharge summary computed.js', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const computedPath = path.join(__dirname, '..', '..', 'config', 'print-templates', 'discharge-summary', 'computed.js');
    const source = fs.readFileSync(computedPath, 'utf-8');

    const data = {
      patient: { birthDate: '1980-06-15', name: [{ given: ['John'], family: 'Doe' }] },
      vitals: [{ obsDatetime: '2026-04-09', temperature: 38.5, systolic: 150, diastolic: 95, spo2: 93, pulse: 88 }],
      labResults: [{ results: [{ display: 'Hemoglobin', value: '6.5', interpretation: 'low', referenceRange: { low: 12, high: 17 } }] }],
      conditions: [{ display: 'Pneumonia', category: 'primary', rank: 1, certainty: 'Confirmed', clinicalStatus: 'active' }],
      encounters: [{ period: { start: '2026-04-05' } }],
      allergies: [{ substance: 'Penicillin', reaction: 'Rash', severity: 'Moderate' }],
      drugOrders: [{ drug: { display: 'Amoxicillin' }, status: 'active' }],
    };

    const result = run(source, data);
    expect(result.patientAge.years).toBe(45);
    expect(result.vitalsAssessment.flags.length).toBeGreaterThan(0);
    expect(result.hasCriticalLabs).toBe(true);
    expect(result.primaryDiagnosis.display).toBe('Pneumonia');
    expect(result.hasAllergies).toBe(true);
    expect(result.activeMedications).toHaveLength(1);
  });
});
