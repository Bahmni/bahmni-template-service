/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { NextFunction, Request, Response } from 'express';
import { validateRenderRequest } from '@src/middleware/validateRenderRequest';

jest.mock('@src/config');

const mockConfig = jest.requireMock('@src/config');

describe('validateRenderRequest', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();
    mockRes = {
      json: jsonSpy,
      status: statusSpy,
    };
    mockNext = jest.fn();
  });

  it('calls next() for valid request with defaults', () => {
    mockReq = {
      body: {
        templateId: 'test-template',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith();
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('calls next() for valid request with all fields', () => {
    mockConfig.PDF_ENABLED = true;
    mockReq = {
      body: {
        templateId: 'discharge',
        format: 'pdf',
        locale: 'en-US',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('returns 400 when templateId is missing', () => {
    mockReq = {
      body: {},
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      message: 'templateId is required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid format', () => {
    mockReq = {
      body: {
        templateId: 'test',
        format: 'xml',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      message: 'Invalid format "xml". Supported formats: html, pdf, email.',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('returns 400 when PDF requested but PDF_ENABLED is false', () => {
    mockConfig.PDF_ENABLED = false;
    mockReq = {
      body: {
        templateId: 'test',
        format: 'pdf',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      message: 'Error: PDF generation is not enabled',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('allows PDF format when PDF_ENABLED is true', () => {
    mockConfig.PDF_ENABLED = true;
    mockReq = {
      body: {
        templateId: 'test',
        format: 'pdf',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('calls next() for email format', () => {
    mockReq = {
      body: {
        templateId: 'test',
        format: 'email',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid locale format', () => {
    mockReq = {
      body: {
        templateId: 'test',
        locale: 'invalid_locale',
      },
    };

    validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(jsonSpy).toHaveBeenCalledWith({
      message: 'Invalid locale "invalid_locale".',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('accepts valid locale formats', () => {
    const validLocales = ['en', 'fr', 'en-US', 'zh-CN'];

    validLocales.forEach((locale) => {
      jest.clearAllMocks();
      mockReq = {
        body: {
          templateId: 'test',
          locale,
        },
      };

      validateRenderRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });
});
