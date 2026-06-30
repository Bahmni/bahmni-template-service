import axios from 'axios';
import { DEFAULT_IMAGE_MIME, HTTP_STATUS } from '../constants';
import { NotFoundError } from '../errors';
import { request } from '../http/httpClient';
import logger from '../logger';

export async function fetchJsonSource(
  sourceName: string,
  url: string,
  authHeaders: Record<string, string>,
): Promise<unknown> {
  try {
    const response = await request(url, {
      headers: {
        Accept: 'application/fhir+json, application/json',
        ...authHeaders,
      },
      context: sourceName,
    });
    return response.data;
  } catch (err) {
    if (
      axios.isAxiosError(err) &&
      err.response?.status === HTTP_STATUS.BAD_REQUEST
    ) {
      logger.warn(
        { sourceName, url },
        'DataResolver: 400 response — returning empty Bundle',
      );
      return { resourceType: 'Bundle', entry: [] };
    }
    throw err;
  }
}

export async function fetchImageSource(
  sourceName: string,
  url: string,
  authHeaders: Record<string, string>,
): Promise<string | null> {
  try {
    const response = await request<ArrayBuffer>(url, {
      headers: { Accept: '*/*', ...authHeaders },
      responseType: 'arraybuffer',
      context: sourceName,
    });

    const buffer = Buffer.from(response.data);
    if (buffer.length === 0) {
      logger.info(
        { sourceName },
        'DataResolver: image source empty — no photo',
      );
      return null;
    }

    const contentType =
      (response.headers['content-type'] as string | undefined)?.split(';')[0] ??
      DEFAULT_IMAGE_MIME;

    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    if (err instanceof NotFoundError) {
      logger.info({ sourceName }, 'DataResolver: image source 404 — no photo');
      return null;
    }
    throw err;
  }
}
