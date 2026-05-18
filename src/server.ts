/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import fs from 'fs';
import http from 'http';
import express, { Request, Response } from 'express';
import { resolve } from './data/resolver';
import { runComputeScript } from './data/scriptRunner';
import { AppError } from './errors';
import logger from './logger';
import { render } from './template/renderer';
import { templateStore } from './template/store';
import {
  DataConfig,
  ResolvedSources,
  RenderRequest,
  RenderResponse,
  ErrorResponse,
} from './types';

const app = express();

app.use(express.json({ limit: '10mb' }));

interface AuthHeaders {
  cookie?: string;
  sessionId?: string;
  authorization?: string;
}

function buildAuthHeaders(req: Request): AuthHeaders {
  return {
    cookie: req.headers.cookie,
    sessionId: req.headers['x-openmrs-session-id'] as string | undefined,
    authorization: req.headers['x-openmrs-authorization'] as string | undefined,
  };
}

app.get('/template-service/api/templates', (_req: Request, res: Response) => {
  const templates = templateStore.list().map((t) => ({
    id: t.id,
    name: t.name,
  }));
  res.json({ templates });
});

app.post(
  '/template-service/api/render',
  async (req: Request, res: Response) => {
    const {
      templateId,
      format = 'html',
      locale = 'en',
      context,
      data,
    } = req.body as RenderRequest;

    if (!templateId) {
      return res
        .status(400)
        .json({ message: 'templateId is required' } satisfies ErrorResponse);
    }

    if (format !== 'html') {
      return res.status(400).json({
        message: `Invalid format "${format}". Only "html" is supported.`,
      } satisfies ErrorResponse);
    }

    if (!/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/.test(locale)) {
      return res.status(400).json({
        message: `Invalid locale "${locale}".`,
      } satisfies ErrorResponse);
    }

    const template = templateStore.get(templateId);
    if (!template) {
      return res.status(404).json({
        message: `Template not found: "${templateId}"`,
      } satisfies ErrorResponse);
    }

    try {
      logger.info(
        {
          templateId,
          hasDataConfig: !!template.dataConfigPath,
          hasComputeScript: !!template.computeScriptPath,
        },
        'Render',
      );

      const auth = buildAuthHeaders(req);

      let resolvedSources: ResolvedSources = {};

      if (template.dataConfigPath) {
        const dataConfig = JSON.parse(
          fs.readFileSync(template.dataConfigPath, 'utf-8'),
        ) as DataConfig;
        resolvedSources = await resolve(dataConfig, context, auth);
      }

      const computed = template.computeScriptPath
        ? await runComputeScript(
            template.computeScriptPath,
            context,
            resolvedSources,
            data,
            locale,
          )
        : {};

      const html = await render(
        template.templatePath,
        computed,
        locale,
        template.stylesheetPath,
        resolvedSources,
        data,
      );

      return res.json({ html } satisfies RenderResponse);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      logger.error({ templateId, message }, 'Render failed');

      if (err instanceof AppError) {
        return res
          .status(err.statusCode)
          .json({ message } satisfies ErrorResponse);
      }

      return res.status(500).json({
        message: 'Render failed',
        detail: message,
      } satisfies ErrorResponse);
    }
  },
);

app.get('/template-service/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT ?? '8080', 10);

function start(): http.Server {
  return app.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        templatesDir:
          process.env.TEMPLATES_DIR ?? '/etc/bahmni_config/print-templates',
      },
      'Bahmni Template Service listening',
    );
  });
}

try {
  const server = start();
  process.on('SIGTERM', () => {
    logger.info('Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
} catch (err) {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
}
