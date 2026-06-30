/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';

import { healthCheck } from './healthCheck';

jest.mock('../config');
jest.mock('../pdf/pdfPool');

const mockConfig = jest.requireMock('../config');
const mockPdfPool = jest.requireMock('../pdf/pdfPool');

describe('healthCheck', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {};
    jsonSpy = jest.fn();
    mockRes = {
      json: jsonSpy,
    };
  });

  it('returns status ok with timestamp', () => {
    mockConfig.PDF_ENABLED = false;

    healthCheck(mockReq as Request, mockRes as Response);

    expect(jsonSpy).toHaveBeenCalledTimes(1);
    const response = jsonSpy.mock.calls[0][0];
    expect(response.status).toBe('ok');
    expect(response.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('returns chromium false when PDF is disabled', () => {
    mockConfig.PDF_ENABLED = false;

    healthCheck(mockReq as Request, mockRes as Response);

    const response = jsonSpy.mock.calls[0][0];
    expect(response.chromium).toBe(false);
  });

  it('returns chromium true when PDF is enabled and pool is ready', () => {
    mockConfig.PDF_ENABLED = true;
    mockPdfPool.isPdfPoolReady = jest.fn().mockReturnValue(true);

    healthCheck(mockReq as Request, mockRes as Response);

    const response = jsonSpy.mock.calls[0][0];
    expect(response.chromium).toBe(true);
    expect(mockPdfPool.isPdfPoolReady).toHaveBeenCalledTimes(1);
  });

  it('returns chromium false when PDF is enabled but pool is not ready', () => {
    mockConfig.PDF_ENABLED = true;
    mockPdfPool.isPdfPoolReady = jest.fn().mockReturnValue(false);

    healthCheck(mockReq as Request, mockRes as Response);

    const response = jsonSpy.mock.calls[0][0];
    expect(response.chromium).toBe(false);
    expect(mockPdfPool.isPdfPoolReady).toHaveBeenCalledTimes(1);
  });

  it('includes all expected fields in response', () => {
    mockConfig.PDF_ENABLED = true;
    mockPdfPool.isPdfPoolReady = jest.fn().mockReturnValue(true);

    healthCheck(mockReq as Request, mockRes as Response);

    const response = jsonSpy.mock.calls[0][0];
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('chromium');
  });
});
