import fs from 'fs';
import path from 'path';
import { TemplateNotFoundError, TemplateDisabledError } from '../errors.js';
import console from 'console';

export default class TemplateStore {
  constructor(templatesDir) {
    this.templatesDir = templatesDir;
    this.registry = null;
  }

  loadRegistry() {
    const registryPath = path.join(this.templatesDir, 'templates.json');
    const raw = fs.readFileSync(registryPath, 'utf-8');
    this.registry = JSON.parse(raw).templates;
    console.log(`Loaded ${this.registry.length} templates from registry`);
  }

  ensureLoaded() {
    if (!this.registry) this.loadRegistry();
  }

  list() {
    this.ensureLoaded();
    return this.registry
      .filter(t => t.enabled)
      .map(({ id, name, description }) => ({ id, name, description }));
  }

  get(templateId) {
    this.ensureLoaded();
    const entry = this.registry.find(t => t.id === templateId);
    if (!entry) {
      throw new TemplateNotFoundError(templateId);
    }
    if (!entry.enabled) {
      throw new TemplateDisabledError(templateId);
    }

    const folder = path.join(this.templatesDir, entry.folder);
    const templateHtml = fs.readFileSync(path.join(folder, 'template.html'), 'utf-8');

    let dataConfig = {};
    const dataConfigPath = path.join(folder, 'data-config.json');
    if (fs.existsSync(dataConfigPath)) {
      const raw = fs.readFileSync(dataConfigPath, 'utf-8').trim();
      if (raw && raw !== '{}') {
        dataConfig = JSON.parse(raw);
      }
    }

    let computedSource = null;
    const computedPath = path.join(folder, 'computed.js');
    if (fs.existsSync(computedPath)) {
      computedSource = fs.readFileSync(computedPath, 'utf-8');
    }

    return {
      id: entry.id,
      templateHtml,
      dataConfig,
      computedSource,
      templatePath: path.join(entry.folder, 'template.html'),
      meta: {
        paperSize: entry.paperSize,
        orientation: entry.orientation,
      },
    };
  }
}
