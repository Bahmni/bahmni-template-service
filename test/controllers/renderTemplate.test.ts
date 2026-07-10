/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';

import { renderTemplate } from '@src/controllers/renderTemplate';
import { AppError, NotFoundError, UnauthorizedError } from '@src/errors';

jest.mock('@src/template/renderPipeline');
jest.mock('@src/pdf/pdfPool');
jest.mock('@src/logger');
jest.mock('@src/email/emailPostprocessor');

const mockPipeline = jest.requireMock('@src/template/renderPipeline');
const mockPdfPool = jest.requireMock('@src/pdf/pdfPool');
const mockLogger = jest.requireMock('@src/logger');
const mockEmailPostprocessor = jest.requireMock('@src/email/emailPostprocessor');

describe('renderTemplate', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let sendSpy: jest.Mock;
  let setHeaderSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();
    sendSpy = jest.fn();
    setHeaderSpy = jest.fn();

    mockRes = {
      json: jsonSpy,
      status: statusSpy,
      send: sendSpy,
      setHeader: setHeaderSpy,
    };

    mockLogger.default = {
      error: jest.fn(),
    };
  });

  describe('auth header extraction', () => {
    it('extracts sessionId from x-openmrs-session-id header', async () => {
      mockReq = {
        headers: {
          'x-openmrs-session-id': 'session123',
        },
        body: {
          templateId: 'test',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            sessionId: 'session123',
          }),
        }),
      );
    });

    it('extracts sessionId from JSESSIONID cookie', async () => {
      mockReq = {
        headers: {
          cookie: 'JSESSIONID=cookie-session-id; other=value',
        },
        body: {
          templateId: 'test',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            sessionId: 'cookie-session-id',
          }),
        }),
      );
    });

    it('extracts authorization from x-openmrs-authorization header', async () => {
      mockReq = {
        headers: {
          'x-openmrs-authorization': 'Bearer token123',
        },
        body: {
          templateId: 'test',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            authorization: 'Bearer token123',
          }),
        }),
      );
    });

    it('prioritizes header sessionId over cookie', async () => {
      mockReq = {
        headers: {
          'x-openmrs-session-id': 'header-session',
          cookie: 'JSESSIONID=cookie-session; other=value',
        },
        body: {
          templateId: 'test',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            sessionId: 'header-session',
          }),
        }),
      );
    });

    it('passes through raw cookie when no JSESSIONID found', async () => {
      mockReq = {
        headers: {
          cookie: 'other-cookie=value; another=test',
        },
        body: {
          templateId: 'test',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: expect.objectContaining({
            cookie: 'other-cookie=value; another=test',
            sessionId: undefined,
          }),
        }),
      );
    });
  });

  describe('HTML format response', () => {
    it('returns JSON with html field for HTML format', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          format: 'html',
        },
      };

      const htmlContent = '<html><body>Rendered Content</body></html>';
      mockPipeline.executePipeline = jest.fn().mockResolvedValue(htmlContent);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({ html: htmlContent });
    });

    it('uses default format (HTML) when not specified', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      const htmlContent = '<html><body>Default Format</body></html>';
      mockPipeline.executePipeline = jest.fn().mockResolvedValue(htmlContent);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({ html: htmlContent });
    });

    it('uses default locale (en) when not specified', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'en',
        }),
      );
    });

    it('passes custom locale when specified', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          locale: 'fr',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'fr',
        }),
      );
    });

    it('passes context and data to pipeline', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          context: { patientId: '123' },
          data: { customField: 'value' },
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { patientId: '123' },
          data: { customField: 'value' },
        }),
      );
    });
  });

  describe('email format response', () => {
    it('returns JSON with html and attachments for email format', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          format: 'email',
        },
      };

      const htmlContent =
        '<html><body><img src="data:image/png;base64,AAAA"></body></html>';
      const emailResult = {
        html: '<html><body><img src="cid:img-1-123"></body></html>',
        attachments: [
          { cid: 'img-1-123', content: 'AAAA', encoding: 'base64', contentType: 'image/png' },
        ],
      };

      mockPipeline.executePipeline = jest.fn().mockResolvedValue(htmlContent);
      mockEmailPostprocessor.processEmail = jest.fn().mockResolvedValue(emailResult);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockEmailPostprocessor.processEmail).toHaveBeenCalledWith(htmlContent);
      expect(jsonSpy).toHaveBeenCalledWith(emailResult);
    });

    it('returns empty attachments when no inline images present', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          format: 'email',
        },
      };

      const htmlContent = '<html><body>No images</body></html>';
      const emailResult = { html: htmlContent, attachments: [] };

      mockPipeline.executePipeline = jest.fn().mockResolvedValue(htmlContent);
      mockEmailPostprocessor.processEmail = jest.fn().mockResolvedValue(emailResult);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith({ html: htmlContent, attachments: [] });
    });
  });

  describe('PDF format response', () => {
    it('converts HTML to PDF and returns buffer', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          format: 'pdf',
        },
      };

      const htmlContent = '<html><body>PDF Content</body></html>';
      const pdfBuffer = Buffer.from('fake-pdf-data');

      mockPipeline.executePipeline = jest.fn().mockResolvedValue(htmlContent);
      mockPdfPool.convertToPdf = jest.fn().mockResolvedValue(pdfBuffer);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPdfPool.convertToPdf).toHaveBeenCalledWith(htmlContent);
      expect(sendSpy).toHaveBeenCalledWith(pdfBuffer);
    });

    it('sets correct Content-Type header for PDF', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
          format: 'pdf',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');
      mockPdfPool.convertToPdf = jest
        .fn()
        .mockResolvedValue(Buffer.from('pdf'));

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
    });

    it('sets Content-Disposition with template filename', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'discharge-summary',
          format: 'pdf',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');
      mockPdfPool.convertToPdf = jest
        .fn()
        .mockResolvedValue(Buffer.from('pdf'));

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="discharge-summary.pdf"',
      );
    });
  });

  describe('error handling', () => {
    it('returns 404 with message for NotFoundError', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'non-existent',
        },
      };

      const error = new NotFoundError('Template not found: "non-existent"');
      mockPipeline.executePipeline = jest.fn().mockRejectedValue(error);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Template not found: "non-existent"',
      });
    });

    it('returns 401 with message for UnauthorizedError', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      const error = new UnauthorizedError('Invalid credentials');
      mockPipeline.executePipeline = jest.fn().mockRejectedValue(error);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    it('returns correct status code for custom AppError', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      const error = new AppError('Custom error', 502);
      mockPipeline.executePipeline = jest.fn().mockRejectedValue(error);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(502);
      expect(jsonSpy).toHaveBeenCalledWith({ message: 'Custom error' });
    });

    it('returns 500 with detail for non-AppError exceptions', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      const error = new Error('Unexpected error occurred');
      mockPipeline.executePipeline = jest.fn().mockRejectedValue(error);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Render failed',
        detail: 'Unexpected error occurred',
      });
    });

    it('logs error with templateId and message', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      const error = new Error('Test error');
      mockPipeline.executePipeline = jest.fn().mockRejectedValue(error);

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockLogger.default.error).toHaveBeenCalledWith(
        { templateId: 'test-template', message: 'Test error' },
        'Render failed',
      );
    });

    it('handles non-Error exceptions gracefully', async () => {
      mockReq = {
        headers: {},
        body: {
          templateId: 'test-template',
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockRejectedValue('string error');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        message: 'Render failed',
        detail: 'string error',
      });
    });
  });

  describe('pipeline integration', () => {
    it('calls executePipeline with all required parameters', async () => {
      mockReq = {
        headers: {
          'x-openmrs-session-id': 'session123',
          'x-openmrs-authorization': 'Bearer token',
        },
        body: {
          templateId: 'discharge',
          format: 'html',
          locale: 'fr',
          context: { patientId: 'P001' },
          data: { notes: 'Extra info' },
        },
      };

      mockPipeline.executePipeline = jest
        .fn()
        .mockResolvedValue('<html>test</html>');

      await renderTemplate(mockReq as Request, mockRes as Response);

      expect(mockPipeline.executePipeline).toHaveBeenCalledWith({
        templateId: 'discharge',
        locale: 'fr',
        context: { patientId: 'P001' },
        data: { notes: 'Extra info' },
        auth: {
          sessionId: 'session123',
          authorization: 'Bearer token',
          cookie: undefined,
        },
      });
    });
  });
});
