/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import logger from '../logger';
import { AuthHeaders, DataConfig, DataSource, ResolvedSources } from '../types';
import { fetchImageSource, fetchJsonSource } from './fetchers';
import { buildUrl } from './urlBuilder';

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
  const authHeaders = buildAuthHeaders(auth);
  const entries = Object.entries(sources);

  const results = await Promise.all(
    entries.map(async ([sourceName, source]) => {
      const url = buildUrl(source, context);
      const value =
        source.api === 'image'
          ? await fetchImageSource(sourceName, url, authHeaders)
          : await fetchJsonSource(sourceName, url, authHeaders);
      return [sourceName, value] as [string, unknown];
    }),
  );

  return Object.fromEntries(results);
}

function buildAuthHeaders(auth: AuthHeaders): Record<string, string> {
  const authHeaders: Record<string, string> = {};
  if (auth.authorization) authHeaders['Authorization'] = auth.authorization;
  if (auth.sessionId) authHeaders['Cookie'] = `JSESSIONID=${auth.sessionId}`;
  else if (auth.cookie) authHeaders['Cookie'] = auth.cookie;
  return authHeaders;
}
