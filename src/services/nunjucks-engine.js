import nunjucks from 'nunjucks';
import { ageFilter, dateFormat, dateTimeFormat, dateDiff, numberFormat, capitalize, truncate } from '../utils/builtins.js';
import fhirpath from 'fhirpath';
import { generateBarcode, generateQrcode } from './barcode.js';

export default class NunjucksEngine {
  constructor(templatesDir, i18n) {
    this.env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(templatesDir, { noCache: true }),
      { autoescape: false }
    );
    this.registerFilters(i18n);
  }

  registerFilters(i18n) {
    this.env.addFilter('age', ageFilter);
    this.env.addFilter('dateFormat', dateFormat);
    this.env.addFilter('dateTimeFormat', dateTimeFormat);
    this.env.addFilter('dateDiff', dateDiff);
    this.env.addFilter('numberFormat', numberFormat);
    this.env.addFilter('capitalize', capitalize);
    this.env.addFilter('truncate', truncate);

    if (i18n) {
      this.env.addFilter('t', i18n.createFilter());
    }

    this.env.addFilter('fhirpathEvaluate', (resource, expression) => {
      return fhirpath.evaluate(resource, expression);
    });

    this.env.addFilter('barcode', function (value, format, height, callback) {
      if (typeof format === 'function') { callback = format; format = 'code128'; height = 30; }
      else if (typeof height === 'function') { callback = height; height = 30; }
      generateBarcode(value, format, height).then(r => callback(null, r)).catch(callback);
    }, true);

    this.env.addFilter('qrcode', function (value, size, callback) {
      if (typeof size === 'function') { callback = size; size = 150; }
      generateQrcode(value, size).then(r => callback(null, r)).catch(callback);
    }, true);
  }

  addFilter(name, fn, async = false) {
    this.env.addFilter(name, fn, async);
  }

  render(templatePath, context) {
    return this.env.render(templatePath, context);
  }

  renderAsync(templatePath, context) {
    return new Promise((resolve, reject) => {
      this.env.render(templatePath, context, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}
