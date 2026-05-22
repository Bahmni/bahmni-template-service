/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import axios from 'axios';
import { FHIR_BASE, OPENMRS_URL, REQUEST_TIMEOUT_MS } from '../config';
import { AXIOS_TIMEOUT_CODE, HTTP_STATUS } from '../constants';
import {
  BadGatewayError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors';
import logger from '../logger';
import { AuthHeaders, DataConfig, DataSource, ResolvedSources } from '../types';


export async function resolve(
  dataConfig: DataConfig,
  context: Record<string, string> | undefined,
  auth: AuthHeaders,
): Promise<ResolvedSources> {
  const hasSources =
    dataConfig.sources != null && Object.keys(dataConfig.sources).length > 0;

  if (!hasSources) return {};

  logger.info('DataResolver: fetch');
  return fetchSources(dataConfig.sources!, context ?? {}, auth);
}

async function fetchSources(
  sources: Record<string, DataSource>,
  context: Record<string, string>,
  auth: AuthHeaders,
): Promise<ResolvedSources> {
  const headers: Record<string, string> = {
    Accept: 'application/fhir+json, application/json',
  };
  if (auth.authorization) headers['Authorization'] = auth.authorization;
  if (auth.sessionId) headers['Cookie'] = `JSESSIONID=${auth.sessionId}`;
  else if (auth.cookie) headers['Cookie'] = auth.cookie;

  const entries = Object.entries(sources);

  const results = await Promise.all(
    entries.map(async ([sourceName, source]) => {
      const url = buildUrl(source, context);
      logger.info({ sourceName, url }, 'DataResolver: fetching source');
      try {
        const response = await axios.get(url, {
          headers,
          timeout: REQUEST_TIMEOUT_MS,
        });
        logger.info({ sourceName, status: response.status }, 'DataResolver: source fetched');
        return [sourceName, response.data] as [string, unknown];
      } catch (err) {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === HTTP_STATUS.UNAUTHORIZED)
            throw new UnauthorizedError(
              'OpenMRS session expired. Please log in again.',
            );
          if (status === HTTP_STATUS.BAD_REQUEST) {
            logger.warn(
              { sourceName, url },
              'DataResolver: 400 response — returning empty Bundle',
            );
            return [sourceName, { resourceType: 'Bundle', entry: [] }] as [
              string,
              unknown,
            ];
          }
          if (status === HTTP_STATUS.NOT_FOUND)
            throw new NotFoundError(
              `OpenMRS resource not found for source: ${sourceName}`,
            );
          if (!err.response) {
            if (err.code === AXIOS_TIMEOUT_CODE) {
              throw new BadGatewayError(
                `OpenMRS API timeout (>${REQUEST_TIMEOUT_MS}ms) when fetching source: ${sourceName}`,
              );
            }
            throw new BadGatewayError(
              `OpenMRS API unreachable when fetching source: ${sourceName}`,
            );
          }
          throw new BadGatewayError(
            `Unexpected status ${status} from OpenMRS for source: ${sourceName}`,
          );
        }
        throw err;
      }
    }),
  );

  return Object.fromEntries(results);
}

function substitute(
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

function buildUrl(source: DataSource, context: Record<string, string>): string {
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
