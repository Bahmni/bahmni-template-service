/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';

import {
  DEFAULT_LOCALE,
  HEADER_AUTHORIZATION,
  HEADER_SESSION_ID,
  HTTP_STATUS,
  JSESSIONID_PREFIX,
  MimeType,
} from '../constants';
import { AppError } from '../errors';
import logger from '../logger';
import { convertToPdf } from '../pdf/pdfPool';
import { executePipeline } from '../template/renderPipeline';
import { AuthHeaders, RenderRequest } from '../types';

function extractAuthHeaders(req: Request): AuthHeaders {
  const rawCookie = req.headers.cookie;
  const jsessionId = rawCookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(JSESSIONID_PREFIX))
    ?.slice(JSESSIONID_PREFIX.length);

  return {
    sessionId:
      (req.headers[HEADER_SESSION_ID] as string | undefined) ?? jsessionId,
    authorization: req.headers[HEADER_AUTHORIZATION] as string | undefined,
    cookie: jsessionId ? undefined : rawCookie,
  };
}

function sendHtmlResponse(res: Response, html: string): void {
  res.json({ html });
}

async function sendPdfResponse(
  res: Response,
  templateId: string,
  html: string,
): Promise<void> {
  const pdfBuffer = await convertToPdf(html);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${templateId}.pdf"`);
  res.send(pdfBuffer);
}

export async function renderTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    templateId,
    format = MimeType.HTML,
    locale = DEFAULT_LOCALE,
    context,
    data,
  } = req.body as RenderRequest;

  try {
    const html = await executePipeline({
      templateId,
      locale,
      context,
      data,
      auth: extractAuthHeaders(req),
    });

    switch (format) {
      case MimeType.HTML:
        sendHtmlResponse(res, html);
        break;
      case MimeType.PDF:
        await sendPdfResponse(res, templateId, html);
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ templateId, message }, 'Render failed');
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ message });
      return;
    }
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      message: 'Render failed',
      detail: message,
    });
  }
}
