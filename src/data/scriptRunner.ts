/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { ValidationError } from '../errors';
import logger from '../logger';
import { evaluateFhirPath } from '../template/fhirPath';
import { loadTranslations } from '../template/renderer';
import { ResolvedSources } from '../types';

type TranslateFn = (key: string, overrideLocale?: string) => string;

export async function runComputeScript(
  scriptPath: string,
  context: Record<string, string> | undefined,
  resolved?: ResolvedSources,
  data?: Record<string, unknown>,
  locale = 'en',
): Promise<Record<string, unknown>> {
  const translations = loadTranslations(locale);
  const englishFallback = locale === 'en' ? translations : loadTranslations('en');
  const translate: TranslateFn = (key, overrideLocale) => {
    const t = overrideLocale ? loadTranslations(overrideLocale) : translations;
    return t[key] ?? englishFallback[key] ?? key;
  };

  try {
    delete require.cache[require.resolve(scriptPath)];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(scriptPath) as {
      compute?: (helpers: {
        context: Record<string, string> | undefined;
        resolved: ResolvedSources | undefined;
        data: Record<string, unknown> | undefined;
        ValidationError: typeof ValidationError;
        fhirPath: typeof evaluateFhirPath;
        translate: TranslateFn;
        locale: string;
      }) => unknown;
    };

    if (typeof mod.compute !== 'function') {
      logger.warn({ scriptPath }, 'No compute function exported — skipping');
      return {};
    }

    const result = await Promise.resolve(
      mod.compute({ context, resolved, data, ValidationError, fhirPath: evaluateFhirPath, translate, locale }),
    );

    if (result == null || typeof result !== 'object' || Array.isArray(result)) {
      logger.warn(
        { scriptPath, type: typeof result },
        'compute() must return a plain object — skipping',
      );
      return {};
    }

    return result as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    logger.error({ scriptPath, err }, 'Error running compute script');
    return {};
  }
}
