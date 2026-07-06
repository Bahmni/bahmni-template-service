/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import axios from 'axios';
import { resolve } from '@src/data/resolver';
import {
  BadGatewayError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@src/errors';

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

  describe('integration', () => {
    it('fetches and returns JSON source data', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { resourceType: 'Patient', id: 'abc-123' },
        headers: {},
      });

      const result = await resolve(
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

      expect(result.patient).toEqual({
        resourceType: 'Patient',
        id: 'abc-123',
      });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${BASE}/openmrs/ws/fhir2/R4/Patient?_id=abc-123`,
        expect.any(Object),
      );
    });

    it('fetches and returns image source as base64 data URI', async () => {
      const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: PNG_BYTES,
        headers: { 'content-type': 'image/png' },
      });

      const result = await resolve(
        {
          sources: {
            patientPhoto: {
              api: 'image',
              resource: '/openmrs/ws/rest/v1/patientImage',
              params: { patientUuid: '{{patientUuid}}' },
            },
          },
        },
        { patientUuid: 'abc-123' },
        {},
      );

      expect(result.patientPhoto).toBe(
        `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
      );
    });

    it('fetches multiple sources in parallel', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 'p1' },
          headers: {},
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { id: 'e1' },
          headers: {},
        });

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

  describe('auth header forwarding', () => {
    it('sets Authorization header when provided', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

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
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

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
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

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
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

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

  describe('error handling', () => {
    it('throws ValidationError for missing context variable', async () => {
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

    it('throws UnauthorizedError on 401', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(401));

      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws NotFoundError on 404 for JSON sources', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(404));

      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('returns null on 404 for image sources', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(404));

      const result = await resolve(
        {
          sources: {
            patientPhoto: {
              api: 'image',
              resource: '/openmrs/ws/rest/v1/patientImage',
            },
          },
        },
        {},
        {},
      );

      expect(result.patientPhoto).toBeNull();
    });

    it('throws BadGatewayError on timeout', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(undefined, 'ECONNABORTED'));

      await expect(
        resolve({ sources: { s: { api: 'rest', resource: '/foo' } } }, {}, {}),
      ).rejects.toBeInstanceOf(BadGatewayError);
    });
  });
});
