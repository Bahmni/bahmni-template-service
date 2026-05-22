/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import nunjucks from 'nunjucks';
import { templatesDir } from '../config';
import { evaluateFhirPath } from './fhirPath';
import {
  barcodeFilter,
  calculateAge,
  formatDate,
  qrcodeFilter,
  round as roundValue,
} from './filters';
import { createTranslator } from './translations';

const envCache = new Map<string, nunjucks.Environment>();

export function createEnvironment(locale: string): nunjucks.Environment {
  const cacheKey = `${locale}::${templatesDir()}`;
  const cached = envCache.get(cacheKey);
  if (cached) return cached;

  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templatesDir(), { noCache: true }),
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

  envCache.set(cacheKey, env);
  return env;
}
