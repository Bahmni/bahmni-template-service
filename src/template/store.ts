/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { templatesDir } from '../config';
import {
  COMPUTE_SCRIPT,
  DATA_CONFIG_FILE,
  REGISTRY_FILE,
  STYLESHEET_FILE,
  TEMPLATE_HTML,
} from '../constants';
import {
  fileExists,
  joinPath,
  readJsonFile,
  resolvePath,
  safePath,
  statFile,
} from '../fileSystem';
import logger from '../logger';
import { LoadedTemplate, TemplateEntry, TemplateRegistry } from '../types';

interface CacheEntry<T> {
  mtimeMs: number;
  value: T;
}

class TemplateStore {
  private registryCache: CacheEntry<TemplateEntry[]> | null = null;

  list(): TemplateEntry[] {
    const registryPath = joinPath(templatesDir(), REGISTRY_FILE);

    const stat = statFile(registryPath);
    if (!stat) {
      this.registryCache = null;
      return [];
    }

    if (this.registryCache && this.registryCache.mtimeMs === stat.mtimeMs) {
      return this.registryCache.value;
    }

    try {
      const registry = readJsonFile<TemplateRegistry>(registryPath);
      const templates = registry.templates ?? [];
      this.registryCache = { mtimeMs: stat.mtimeMs, value: templates };
      return templates;
    } catch (err) {
      logger.error({ err }, 'Failed to read templates.json');
      return [];
    }
  }

  get(templateId: string): LoadedTemplate | null {
    const entries = this.list();
    const entry = entries.find((t) => t.id === templateId);

    if (!entry) {
      logger.warn({ templateId }, 'Template not found');
      return null;
    }

    const root = resolvePath(templatesDir());
    const templateDir = safePath(root, entry.folder);
    if (!templateDir) {
      logger.error(
        { templateId, folder: entry.folder },
        'Invalid template folder',
      );
      return null;
    }

    const templateHtmlPath = joinPath(templateDir, TEMPLATE_HTML);
    if (!fileExists(templateHtmlPath)) {
      logger.error({ templateId }, 'Missing template.html');
      return null;
    }

    const templatePath = joinPath(entry.folder, TEMPLATE_HTML);
    const dataConfigPath = joinPath(templateDir, DATA_CONFIG_FILE);
    const computeScriptPath = joinPath(templateDir, COMPUTE_SCRIPT);
    const cssPath = joinPath(templateDir, STYLESHEET_FILE);

    return {
      id: entry.id,
      name: entry.name,
      templatePath,
      dataConfigPath: fileExists(dataConfigPath) ? dataConfigPath : undefined,
      computeScriptPath: fileExists(computeScriptPath)
        ? computeScriptPath
        : undefined,
      stylesheetPath: fileExists(cssPath) ? cssPath : undefined,
    };
  }

  clearCache(): void {
    this.registryCache = null;
  }
}

export const templateStore = new TemplateStore();
