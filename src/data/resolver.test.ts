/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import axios from 'axios';
import {
  BadGatewayError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors';
import { resolve } from './resolver';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

const BASE = 'http://openmrs:8080';

function axiosError(status?: number, code?: string): Error {
  const err = new Error('request failed') as Error & {
    isAxiosError: boolean;
    response?: { status: number; data: unknown };
    code?: string;
  };
  err.isAxiosError = true;
  if (status !== undefined) err.response = { status, data: {} };
  if (code) err.code = code;
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAxios.isAxiosError.mockImplementation(
    (err): err is import('axios').AxiosError => !!(err as any)?.isAxiosError,
  );
});

describe('resolver', () => {
  describe('empty sources', () => {
    it('returns {} without calling axios when sources is empty', async () => {
      const result = await resolve({ sources: {} }, {}, {});
      expect(result).toEqual({});
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('returns {} without calling axios when sources is undefined', async () => {
      const result = await resolve({}, {}, {});
      expect(result).toEqual({});
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe('URL construction', () => {
    it('builds a FHIR URL with context substitution and params', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { resourceType: 'Patient' },
      });
      await resolve(
        {
          sources: {
            patient: {
              api: 'fhir',
              resource: 'Patient',
              params: { _id: '{{patientUuid}}' },
            },
          },
        },
        { patientUuid: 'abc-123' },
        {},
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${BASE}/openmrs/ws/fhir2/R4/Patient?_id=abc-123`,
        expect.any(Object),
      );
    });

    it('builds a REST URL with a full resource path', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: {
            profile: {
              api: 'rest',
              resource: '/openmrs/ws/rest/v1/patientprofile/{{patientUuid}}',
            },
          },
        },
        { patientUuid: 'abc-123' },
        {},
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${BASE}/openmrs/ws/rest/v1/patientprofile/abc-123`,
        expect.any(Object),
      );
    });

    it('appends array params as repeated keys', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: {
            meds: {
              api: 'fhir',
              resource: 'MedicationRequest',
              params: {
                _include: [
                  'MedicationRequest:encounter',
                  'MedicationRequest:medication',
                ],
              },
            },
          },
        },
        {},
        {},
      );
      const url = mockedAxios.get.mock.calls[0][0] as string;
      expect(url).toContain('_include=MedicationRequest%3Aencounter');
      expect(url).toContain('_include=MedicationRequest%3Amedication');
    });

    it('throws ValidationError for a missing context variable', async () => {
      await expect(
        resolve(
          {
            sources: {
              patient: {
                api: 'fhir',
                resource: 'Patient',
                params: { _id: '{{patientUuid}}' },
              },
            },
          },
          {},
          {},
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('auth header forwarding', () => {
    it('sets Authorization header when provided', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: { s: { api: 'rest', resource: '/openmrs/ws/rest/v1/foo' } },
        },
        {},
        { authorization: 'Basic dXNlcjpwYXNz' },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Basic dXNlcjpwYXNz',
          }),
        }),
      );
    });

    it('sets Cookie as JSESSIONID when sessionId is provided', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: { s: { api: 'rest', resource: '/openmrs/ws/rest/v1/foo' } },
        },
        {},
        { sessionId: 'sess-abc' },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Cookie: 'JSESSIONID=sess-abc' }),
        }),
      );
    });

    it('forwards raw cookie when only cookie is provided', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: { s: { api: 'rest', resource: '/openmrs/ws/rest/v1/foo' } },
        },
        {},
        { cookie: 'JSESSIONID=raw-value; other=x' },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'JSESSIONID=raw-value; other=x',
          }),
        }),
      );
    });

    it('prefers sessionId cookie over raw cookie when both are present', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, data: {} });
      await resolve(
        {
          sources: { s: { api: 'rest', resource: '/openmrs/ws/rest/v1/foo' } },
        },
        {},
        { sessionId: 'sess-priority', cookie: 'JSESSIONID=raw-value' },
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: 'JSESSIONID=sess-priority',
          }),
        }),
      );
    });
  });

  describe('HTTP error mapping', () => {
    it('throws UnauthorizedError on 401', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(401));
      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('returns empty Bundle on 400 without throwing', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(400));
      const result = await resolve(
        { sources: { patient: { api: 'rest', resource: '/foo' } } },
        {},
        {},
      );
      expect(result).toEqual({
        patient: { resourceType: 'Bundle', entry: [] },
      });
    });

    it('throws NotFoundError on 404', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(404));
      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws BadGatewayError on ECONNABORTED (timeout)', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(undefined, 'ECONNABORTED'));
      const err = await resolve(
        { sources: { s: { api: 'rest', resource: '/foo' } } },
        {},
        {},
      ).catch((e) => e);
      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toMatch(/timeout/i);
    });

    it('throws BadGatewayError when no response (network unreachable)', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(undefined, undefined));
      const err = await resolve(
        { sources: { s: { api: 'rest', resource: '/foo' } } },
        {},
        {},
      ).catch((e) => e);
      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toMatch(/unreachable/i);
    });

    it('throws BadGatewayError on unexpected 5xx', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(503));
      const err = await resolve(
        { sources: { s: { api: 'rest', resource: '/foo' } } },
        {},
        {},
      ).catch((e) => e);
      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toContain('503');
    });

    it('re-throws non-Axios errors unchanged', async () => {
      const nonAxios = new TypeError('not an axios error');
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(nonAxios);
      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(TypeError);
    });
  });

  describe('parallel fetch', () => {
    it('fetches multiple sources in parallel and returns all results', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: { id: 'p1' } })
        .mockResolvedValueOnce({ status: 200, data: { id: 'e1' } });
      const result = await resolve(
        {
          sources: {
            patient: { api: 'fhir', resource: 'Patient' },
            encounter: { api: 'fhir', resource: 'Encounter' },
          },
        },
        {},
        {},
      );
      expect(result.patient).toEqual({ id: 'p1' });
      expect(result.encounter).toEqual({ id: 'e1' });
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });
});
