/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { resolve } from '../data/resolver';
import { runComputeScript } from '../data/scriptRunner';
import { NotFoundError } from '../errors';
import { readJsonFile } from '../fileSystem';
import logger from '../logger';
import { AuthHeaders, DataConfig, ResolvedSources } from '../types';
import { render } from './renderer';
import { templateStore } from './store';

export interface PipelineInput {
  templateId: string;
  locale: string;
  context?: Record<string, string>;
  data?: Record<string, unknown>;
  auth: AuthHeaders;
}

export async function executePipeline(input: PipelineInput): Promise<string> {
  const { templateId, locale, context, data, auth } = input;

  const template = templateStore.get(templateId);
  if (!template) {
    throw new NotFoundError(`Template not found: "${templateId}"`);
  }

  logger.info(
    {
      templateId,
      hasDataConfig: !!template.dataConfigPath,
      hasComputeScript: !!template.computeScriptPath,
    },
    'Render',
  );

  let resolvedSources: ResolvedSources = {};
  if (template.dataConfigPath) {
    const dataConfig = readJsonFile<DataConfig>(template.dataConfigPath);
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

  return render(
    template.templatePath,
    computed,
    locale,
    template.stylesheetPath,
    resolvedSources,
    data,
  );
}
