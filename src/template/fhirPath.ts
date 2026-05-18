/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import fhirpath from 'fhirpath';
import logger from '../logger';

export function evaluateFhirPath(
  resource: unknown,
  expression: string,
): unknown {
  if (resource == null) return null;

  try {
    const results: unknown[] = fhirpath.evaluate(
      resource,
      expression,
    ) as unknown[];

    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    return results;
  } catch (err) {
    logger.error({ expression, err }, 'FHIRPath evaluation error');
    return null;
  }
}
