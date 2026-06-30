/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { FHIR_BASE, OPENMRS_URL } from '../config';
import { ValidationError } from '../errors';
import { DataSource } from '../types';

export function substitute(
  template: string,
  context: Record<string, string>,
  label: string,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
    const resolved = context[varName];
    if (resolved == null) {
      throw new ValidationError(
        `Missing context variable "{{${varName}}}" required by ${label}`,
      );
    }
    return resolved;
  });
}

export function buildUrl(
  source: DataSource,
  context: Record<string, string>,
): string {
  const resource = substitute(source.resource, context, `resource path`);
  const base =
    source.api === 'fhir'
      ? `${FHIR_BASE}/${resource}`
      : `${OPENMRS_URL}${resource}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(source.params ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      params.append(key, substitute(v, context, `param "${key}"`));
    }
  }

  const paramStr = params.toString();
  return `${base}${paramStr ? `?${paramStr}` : ''}`;
}
