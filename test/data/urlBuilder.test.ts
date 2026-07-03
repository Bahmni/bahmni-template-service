/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { buildUrl, substitute } from '@src/data/urlBuilder';
import { ValidationError } from '@src/errors';
import { DataSource } from '@src/types';

const BASE = 'http://openmrs:8080';

describe('urlBuilder', () => {
  describe('substitute', () => {
    it('replaces template variables with context values', () => {
      const result = substitute(
        'Patient/{{patientUuid}}',
        { patientUuid: 'abc-123' },
        'test',
      );
      expect(result).toBe('Patient/abc-123');
    });

    it('replaces multiple variables', () => {
      const result = substitute(
        '{{resource}}/{{id}}/{{action}}',
        { resource: 'Patient', id: '123', action: 'view' },
        'test',
      );
      expect(result).toBe('Patient/123/view');
    });

    it('throws ValidationError when variable is missing', () => {
      expect(() => substitute('Patient/{{patientUuid}}', {}, 'test')).toThrow(
        ValidationError,
      );
    });

    it('includes label in error message', () => {
      expect(() => substitute('{{missing}}', {}, 'my custom label')).toThrow(
        /my custom label/,
      );
    });
  });

  describe('buildUrl', () => {
    it('builds a FHIR URL with context substitution', () => {
      const source: DataSource = {
        api: 'fhir',
        resource: 'Patient',
        params: { _id: '{{patientUuid}}' },
      };

      const url = buildUrl(source, { patientUuid: 'abc-123' });

      expect(url).toBe(`${BASE}/openmrs/ws/fhir2/R4/Patient?_id=abc-123`);
    });

    it('builds a REST URL with full resource path', () => {
      const source: DataSource = {
        api: 'rest',
        resource: '/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}',
      };

      const url = buildUrl(source, { patientUuid: 'abc-123' });

      expect(url).toBe(`${BASE}/openmrs/ws/rest/v1/patientprofile/abc-123`);
    });

    it('builds URL without params when none provided', () => {
      const source: DataSource = {
        api: 'fhir',
        resource: 'Patient',
      };

      const url = buildUrl(source, {});

      expect(url).toBe(`${BASE}/openmrs/ws/fhir2/R4/Patient`);
    });

    it('appends array params as repeated keys', () => {
      const source: DataSource = {
        api: 'fhir',
        resource: 'MedicationRequest',
        params: {
          _include: [
            'MedicationRequest:encounter',
            'MedicationRequest:medication',
          ],
        },
      };

      const url = buildUrl(source, {});

      expect(url).toContain('_include=MedicationRequest%3Aencounter');
      expect(url).toContain('_include=MedicationRequest%3Amedication');
    });

    it('substitutes variables in param values', () => {
      const source: DataSource = {
        api: 'rest',
        resource: '/openmrs/ws/rest/v1/patientImage',
        params: { patientUuid: '{{patientUuid}}' },
      };

      const url = buildUrl(source, { patientUuid: 'xyz-789' });

      expect(url).toBe(
        `${BASE}/openmrs/ws/rest/v1/patientImage?patientUuid=xyz-789`,
      );
    });

    it('throws ValidationError when context variable is missing in resource', () => {
      const source: DataSource = {
        api: 'fhir',
        resource: 'Patient/{{patientUuid}}',
      };

      expect(() => buildUrl(source, {})).toThrow(ValidationError);
    });

    it('throws ValidationError when context variable is missing in param', () => {
      const source: DataSource = {
        api: 'fhir',
        resource: 'Patient',
        params: { _id: '{{patientUuid}}' },
      };

      expect(() => buildUrl(source, {})).toThrow(ValidationError);
    });

    it('handles image API type correctly', () => {
      const source: DataSource = {
        api: 'image',
        resource: '/openmrs/ws/rest/v1/patientImage',
        params: { patientUuid: '{{patientUuid}}' },
      };

      const url = buildUrl(source, { patientUuid: 'abc-123' });

      expect(url).toBe(
        `${BASE}/openmrs/ws/rest/v1/patientImage?patientUuid=abc-123`,
      );
    });
  });
});
