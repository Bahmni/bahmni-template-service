/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { Request, Response } from 'express';
import { DEFAULT_LOCALE, HEADER_AUTHORIZATION, HEADER_SESSION_ID, HTTP_STATUS, JSESSIONID_PREFIX, LOCALE_REGEX, RENDER_FORMAT } from './constants';
import { AppError } from './errors';
import logger from './logger';
import { executePipeline } from './template/renderPipeline';
import { templateStore } from './template/store';
import { AuthHeaders, RenderRequest } from './types';

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

export function listTemplates(_req: Request, res: Response): void {
  const templates = templateStore
    .list()
    .map((t) => ({ id: t.id, name: t.name }));
  res.json({ templates });
}

export async function renderTemplate(
  req: Request,
  res: Response,
): Promise<void> {
  const {
    templateId,
    format = RENDER_FORMAT,
    locale = DEFAULT_LOCALE,
    context,
    data,
  } = req.body as RenderRequest;

  if (!templateId) {
    res
      .status(400)
      .json({ message: 'templateId is required' });
    return;
  }

  if (format !== RENDER_FORMAT) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: `Invalid format "${format}". Only "${RENDER_FORMAT}" is supported.`,
    });
    return;
  }

  if (!LOCALE_REGEX.test(locale)) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      message: `Invalid locale "${locale}".`,
    });
    return;
  }

  try {
    const html = await executePipeline({
      templateId,
      locale,
      context,
      data,
      auth: extractAuthHeaders(req),
    });
    res.json({ html });
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

export function healthCheck(_req: Request, res: Response): void {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}
