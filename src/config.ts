/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import {
  DEFAULT_OPENMRS_TIMEOUT_MS,
  DEFAULT_OPENMRS_URL,
  DEFAULT_PORT,
  DEFAULT_TEMPLATES_DIR,
  FHIR_API_PATH,
} from './constants';

export const PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : DEFAULT_PORT;

export function templatesDir(): string {
  return process.env.TEMPLATES_DIR ?? DEFAULT_TEMPLATES_DIR;
}

export const OPENMRS_URL = process.env.OPENMRS_URL ?? DEFAULT_OPENMRS_URL;
export const FHIR_BASE = `${OPENMRS_URL}${FHIR_API_PATH}`;
export const REQUEST_TIMEOUT_MS = process.env.OPENMRS_TIMEOUT_MS
  ? parseInt(process.env.OPENMRS_TIMEOUT_MS, 10)
  : DEFAULT_OPENMRS_TIMEOUT_MS;
