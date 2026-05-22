/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */
import { DEFAULT_LOCALE } from '../constants';
import { AppError, ValidationError } from '../errors';
import logger from '../logger';
import { evaluateFhirPath } from '../template/fhirPath';
import { createTranslator, TranslateFn } from '../template/translations';
import { ResolvedSources } from '../types';

export async function runComputeScript(
  scriptPath: string,
  context: Record<string, string> | undefined,
  resolved?: ResolvedSources,
  data?: Record<string, unknown>,
  locale = DEFAULT_LOCALE,
): Promise<Record<string, unknown>> {
  const translate = createTranslator(locale);

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
      mod.compute({
        context,
        resolved,
        data,
        ValidationError,
        fhirPath: evaluateFhirPath,
        translate,
        locale,
      }),
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
    throw new AppError('Compute script failed', 500);
  }
}
