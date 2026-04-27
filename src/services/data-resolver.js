import config from '../config.js';
import { DataFetchError } from '../errors.js';
import logger from '../logger.js';

if (!config.tlsRejectUnauthorized) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function interpolate(template, context) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
}

function buildUrl(source, context) {
  const base = config.openmrsUrl;
  if (source.api === 'fhir') {
    const resource = source.resource;
    const params = source.params || {};
    const interpolated = {};
    for (const [k, v] of Object.entries(params)) {
      interpolated[k] = interpolate(v, context);
    }
    if (interpolated.id) {
      return `${base}/openmrs/ws/fhir2/R4/${resource}/${interpolated.id}`;
    }
    const qs = new URLSearchParams(interpolated).toString();
    return `${base}/openmrs/ws/fhir2/R4/${resource}${qs ? '?' + qs : ''}`;
  }

  if (source.api === 'rest') {
    const endpoint = interpolate(source.endpoint, context);
    return `${base}/openmrs/ws/rest/v1${endpoint}`;
  }

  throw new Error(`Unknown API type: ${source.api}`);
}

async function fetchSource(url, sessionToken) {
  const headers = { 'Accept': 'application/json' };
  if (sessionToken) {
    headers['Cookie'] = `JSESSIONID=${sessionToken}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new DataFetchError(`OpenMRS fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

export async function resolve(sources, context, sessionToken) {
  if (!sources || Object.keys(sources).length === 0) return {};

  const entries = Object.entries(sources);
  const results = await Promise.allSettled(
    entries.map(async ([name, source]) => {
      const url = buildUrl(source, context);
      logger.info('OpenMRS fetch', { source: name, api: source.api, url });
      const data = await fetchSource(url, sessionToken);
      return [name, data];
    })
  );

  const resolved = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const [name, data] = result.value;
      resolved[name] = data;
    }
  }
  return resolved;
}

// Exported for testing
export { interpolate, buildUrl };
