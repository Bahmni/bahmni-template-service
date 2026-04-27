import path from 'path';
import config from '../config.js';
import { ValidationError } from '../errors.js';
import TemplateStore from './template-store.js';
import I18n from './i18n.js';
import NunjucksEngine from './nunjucks-engine.js';
import { resolve as resolveData } from './data-resolver.js';
import { inferMode, merge } from './data-merger.js';
import { run as runComputed } from './computed-runner.js';
import { process as processEmail } from './email-postprocessor.js';

export default class RenderService {
  constructor() {
    this.store = new TemplateStore(config.templatesDir);
    const i18nDir = path.join(config.templatesDir, '_i18n');
    this.i18n = new I18n(i18nDir, config.defaultLocale);
    this.engine = new NunjucksEngine(config.templatesDir, this.i18n);
  }

  async render({ templateId, format = 'html', locale, context: reqContext, data: reqData, sessionCookie }) {
    if (!templateId) {
      throw new ValidationError('templateId is required');
    }

    const template = this.store.get(templateId);

    const finalData = await this.resolveData(template.dataConfig, reqContext, reqData, sessionCookie);

    const computed = runComputed(template.computedSource, finalData);

    const resolvedLocale = this.i18n.resolve(locale);

    const html = await this.engine.renderAsync(template.templatePath, {
      ...finalData,
      computed,
      locale: resolvedLocale,
      now: new Date().toISOString(),
    });

    return this.formatOutput(html, format, template);
  }

  async resolveData(dataConfig, reqContext, reqData, sessionCookie) {
    const mode = inferMode(dataConfig, reqData);

    if (mode === 'passthrough') {
      return reqData || {};
    }

    const fetched = await resolveData(dataConfig.sources, reqContext, sessionCookie);

    if (mode === 'hybrid') {
      return merge(fetched, reqData);
    }

    return fetched;
  }

  async formatOutput(html, format, template) {
    if (format === 'pdf') {
      const { convert } = await import('./pdf-pool.js');
      return {
        type: 'pdf',
        body: await convert(html, template.meta),
        filename: `${template.id}.pdf`,
      };
    }

    if (format === 'email') {
      return {
        type: 'email',
        body: processEmail(html),
      };
    }

    return { type: 'html', body: html };
  }
}
