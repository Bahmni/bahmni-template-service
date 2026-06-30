import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { REQUEST_TIMEOUT_MS } from '../config';
import { AXIOS_TIMEOUT_CODE, HTTP_STATUS } from '../constants';
import { BadGatewayError, NotFoundError, UnauthorizedError } from '../errors';
import logger from '../logger';

export interface HttpClientOptions extends Omit<AxiosRequestConfig, 'url'> {
  context?: string;
}

export async function request<T = unknown>(
  url: string,
  options: HttpClientOptions = {},
): Promise<AxiosResponse<T>> {
  const { context, ...axiosOptions } = options;
  const logContext = context ? { context, url } : { url };

  logger.info(logContext, 'HttpClient: sending request');

  try {
    const response = await axios.get<T>(url, {
      timeout: REQUEST_TIMEOUT_MS,
      ...axiosOptions,
    });

    logger.info(
      { ...logContext, status: response.status },
      'HttpClient: request completed',
    );

    return response;
  } catch (err) {
    throw mapError(err, context);
  }
}

function mapError(err: unknown, context?: string): Error {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const contextMsg = context ? ` (${context})` : '';

    if (status === HTTP_STATUS.UNAUTHORIZED) {
      return new UnauthorizedError('Session expired. Please log in again.');
    }

    if (status === HTTP_STATUS.NOT_FOUND) {
      return new NotFoundError(`Resource not found${contextMsg}`);
    }

    if (!err.response) {
      if (err.code === AXIOS_TIMEOUT_CODE) {
        return new BadGatewayError(
          `API timeout (>${REQUEST_TIMEOUT_MS}ms)${contextMsg}`,
        );
      }
      return new BadGatewayError(`API unreachable${contextMsg}`);
    }

    if (status && status >= 500) {
      return new BadGatewayError(`Unexpected status ${status}${contextMsg}`);
    }

    return err;
  }

  return err as Error;
}
