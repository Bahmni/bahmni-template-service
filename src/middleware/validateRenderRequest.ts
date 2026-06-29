/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { NextFunction, Request, Response } from 'express';

import { PDF_ENABLED } from '../config';
import {
  DEFAULT_LOCALE,
  HTML_FORMAT,
  LOCALE_REGEX,
  PDF_FORMAT,
  RENDER_FORMATS,
} from '../constants';
import { AppError, ValidationError } from '../errors';
import { RenderRequest } from '../types';

export function validateRenderRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const {
    templateId,
    format = HTML_FORMAT,
    locale = DEFAULT_LOCALE,
  } = req.body as RenderRequest;

  try {
    if (!templateId) {
      throw new ValidationError('templateId is required');
    }

    if (!RENDER_FORMATS.includes(format as (typeof RENDER_FORMATS)[number])) {
      throw new ValidationError(
        `Invalid format "${format}". Supported formats: ${RENDER_FORMATS.join(', ')}.`,
      );
    }

    if (format === PDF_FORMAT && !PDF_ENABLED) {
      throw new ValidationError(
        'PDF generation is not enabled on this instance. Set PDF_ENABLED=true to enable it.',
      );
    }

    if (!LOCALE_REGEX.test(locale)) {
      throw new ValidationError(`Invalid locale "${locale}".`);
    }

    next();
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ message: (err as Error).message });
      return;
    }
    next(err);
  }
}
