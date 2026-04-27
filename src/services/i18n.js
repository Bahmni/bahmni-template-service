import fs from 'fs';
import path from 'path';

export default class I18n {
  constructor(i18nDir, defaultLocale = 'en') {
    this.defaultLocale = defaultLocale;
    this.translations = {};
    this.load(i18nDir);
  }

  load(i18nDir) {
    if (!fs.existsSync(i18nDir)) return;

    const files = fs.readdirSync(i18nDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const locale = path.basename(file, '.json');
      const raw = fs.readFileSync(path.join(i18nDir, file), 'utf-8');
      this.translations[locale] = JSON.parse(raw);
    }
  }

  resolve(locale) {
    const resolvedLocale = locale && this.translations[locale] ? locale : this.defaultLocale;
    return resolvedLocale;
  }

  createFilter() {
    const translations = this.translations;
    const defaultLocale = this.defaultLocale;

    return function tFilter(key, localeOverride) {
      const locale = (typeof localeOverride === 'string' && localeOverride)
        || this.ctx?.locale
        || defaultLocale;
      return translations[locale]?.[key] ?? translations[defaultLocale]?.[key] ?? key;
    };
  }
}
