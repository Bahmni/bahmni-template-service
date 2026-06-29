/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import nunjucks from 'nunjucks';

import { NUNJUCKS_CACHE, templatesDir } from '../config';
import { evaluateFhirPath } from './fhirPath';
import {
  barcodeFilter,
  calculateAge,
  formatDate,
  qrcodeFilter,
  round as roundValue,
} from './filters';
import { createTranslator } from './translations';
import { AssetService } from './assetService';

const envCache = new Map<string, nunjucks.Environment>();

export function createEnvironment(locale: string): nunjucks.Environment {
  const cacheKey = `${locale}::${templatesDir()}`;
  const cached = envCache.get(cacheKey);
  if (cached) return cached;

  const assetService = new AssetService(templatesDir());

  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templatesDir(), { noCache: !NUNJUCKS_CACHE }),
    { autoescape: true, trimBlocks: true, lstripBlocks: true },
  );

  env.addFilter('t', createTranslator(locale));

  env.addFilter('barcode', barcodeFilter, true);
  env.addFilter('qrcode', qrcodeFilter, true);

  env.addFilter('dateFormat', (value: string): string =>
    formatDate(value, locale),
  );

  env.addFilter('age', (birthDate: string): string => calculateAge(birthDate));

  env.addFilter(
    'fhirpathEvaluate',
    (resource: unknown, expr: string): unknown =>
      evaluateFhirPath(resource, expr),
  );

  env.addFilter('round', (value: number, decimals: number = 0): string =>
    roundValue(value, decimals),
  );

  // Converts a named asset filename (e.g. 'logo.png') to a base64 data URI.
  // Assets are resolved from the shared `assets/` folder inside TEMPLATES_DIR.
  // Use this filter whenever an image must be self-contained in a PDF:
  //   <img src="{{ 'hospital-logo.png' | asset }}" />
  env.addFilter('asset', (relativePath: unknown): string =>
    assetService.toDataUri(relativePath),
  );

  envCache.set(cacheKey, env);
  return env;
}
