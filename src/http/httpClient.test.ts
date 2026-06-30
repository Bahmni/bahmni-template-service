/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import axios from 'axios';
import { BadGatewayError, NotFoundError, UnauthorizedError } from '../errors';
import { request } from './httpClient';

jest.mock('axios');
const mockedAxios = jest.mocked(axios);

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

describe('httpClient', () => {
  describe('request', () => {
    it('makes a successful GET request', async () => {
      const mockData = { id: '123', name: 'Test' };
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: mockData,
        headers: {},
      });

      const response = await request('http://example.com/resource', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(response.data).toEqual(mockData);
      expect(response.status).toBe(200);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://example.com/resource',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token' },
        }),
      );
    });

    it('includes context in logs when provided', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {},
        headers: {},
      });

      await request('http://example.com/resource', {
        context: 'testSource',
      });

      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('throws NotFoundError on 404', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(404));

      await expect(
        request('http://example.com/resource'),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws UnauthorizedError on 401', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(401));

      await expect(
        request('http://example.com/resource'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws BadGatewayError on timeout', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(undefined, 'ECONNABORTED'));

      const err = await request('http://example.com/resource').catch((e) => e);

      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toMatch(/timeout/i);
    });

    it('throws BadGatewayError when network is unreachable', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(undefined, undefined));

      const err = await request('http://example.com/resource').catch((e) => e);

      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toMatch(/unreachable/i);
    });

    it('throws BadGatewayError on server errors (5xx)', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(503));

      const err = await request('http://example.com/resource').catch((e) => e);

      expect(err).toBeInstanceOf(BadGatewayError);
      expect(err.message).toContain('503');
    });

    it('re-throws original axios error for 400 Bad Request', async () => {
      const originalError = axiosError(400);
      mockedAxios.get.mockRejectedValue(originalError);

      const err = await request('http://example.com/resource').catch((e) => e);

      expect(err).toBe(originalError);
      expect(axios.isAxiosError(err)).toBe(true);
    });

    it('includes context in error messages when provided', async () => {
      mockedAxios.get.mockRejectedValue(axiosError(404));

      const err = await request('http://example.com/resource', {
        context: 'patientSource',
      }).catch((e) => e);

      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.message).toContain('patientSource');
    });

    it('re-throws non-Axios errors unchanged', async () => {
      const nonAxios = new TypeError('not an axios error');
      mockedAxios.isAxiosError.mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(nonAxios);

      await expect(
        request('http://example.com/resource'),
      ).rejects.toBeInstanceOf(TypeError);
    });

    it('passes through custom axios options', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('test'),
        headers: {},
      });

      await request('http://example.com/image', {
        responseType: 'arraybuffer',
        headers: { Accept: 'image/*' },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://example.com/image',
        expect.objectContaining({
          responseType: 'arraybuffer',
          headers: { Accept: 'image/*' },
        }),
      );
    });
  });
});
