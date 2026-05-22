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
import { PORT, templatesDir } from './config';
import { BODY_SIZE_LIMIT, SHUTDOWN_TIMEOUT_MS } from './constants';
import logger from './logger';
import router from './router';

const app = express();
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(router);

function start(): http.Server {
  return app.listen(PORT, () => {
    logger.info(
      { port: PORT, templatesDir: templatesDir() },
      'Bahmni Template Service listening5',
    );
  });
}

try {
  const server = start();
  function shutdown(): void {
    logger.info('Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (err) {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
}
