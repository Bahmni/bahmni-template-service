/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import http from 'http';

import express from 'express';

import { MAX_CONCURRENT_PDF, PDF_ENABLED, PORT, templatesDir } from './config';
import { BODY_SIZE_LIMIT, SHUTDOWN_TIMEOUT_MS } from './constants';
import { PdfNotSupportedError } from './errors';
import logger from './logger';
import { initPdfPool, shutdownPdfPool } from './pdf/pdfPool';
import router from './router';

const app = express();
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(router);

async function start(): Promise<http.Server> {
  if (PDF_ENABLED) {
    try {
      await initPdfPool(MAX_CONCURRENT_PDF);
      logger.info(
        { concurrency: MAX_CONCURRENT_PDF },
        'PDF pool initialised — Playwright/Chromium ready',
      );
    } catch (err) {
      if (err instanceof PdfNotSupportedError) {
        logger.warn(
          'PDF_ENABLED=true but Playwright is not installed in this image. PDF requests will be rejected with 503. Switch to the -pdf tagged image to enable PDF generation.',
        );
      } else {
        throw err;
      }
    }
  }

  return app.listen(PORT, () => {
    logger.info(
      { port: PORT, templatesDir: templatesDir(), pdfEnabled: PDF_ENABLED },
      'Bahmni Template Service listening',
    );
  });
}

void (async () => {
  try {
    const server = await start();

    async function shutdown(): Promise<void> {
      logger.info('Shutting down');
      server.close(async () => {
        try {
          await shutdownPdfPool();
        } catch {
          // pool may not have been initialised
        }
        process.exit(0);
      });
      setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    }

    process.on('SIGTERM', () => void shutdown());
    process.on('SIGINT', () => void shutdown());
  } catch (err) {
    logger.fatal({ err }, 'Fatal startup error');
    process.exit(1);
  }
})();
