import fs from 'fs';
import path from 'path';
import * as bwipjs from 'bwip-js';
import nunjucks from 'nunjucks';
import QRCodeSVG from 'qrcode-svg';
import logger from '../logger';
import { evaluateFhirPath } from './fhirPath';

function templatesDir(): string {
  return process.env.TEMPLATES_DIR ?? '/etc/bahmni_config/print-templates';
}

interface TranslationCacheEntry {
  mtimeMs: number;
  value: Record<string, string>;
}

type BarcodeCallback = (
  err: Error | null,
  result: nunjucks.runtime.SafeString,
) => void;

const translationCache = new Map<string, TranslationCacheEntry>();

function htmlEscape(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function loadTranslations(locale: string): Record<string, string> {
  const filePath = path.join(templatesDir(), '_i18n', `${locale}.json`);
  try {
    const stat = fs.statSync(filePath);
    const cached = translationCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const value = JSON.parse(content) as Record<string, string>;
    translationCache.set(filePath, { mtimeMs: stat.mtimeMs, value });
    return value;
  } catch {
    translationCache.delete(filePath);
    return {};
  }
}

export function _resetTranslationCacheForTests(): void {
  translationCache.clear();
}

function createEnvironment(locale: string): nunjucks.Environment {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(templatesDir(), { noCache: true }),
    { autoescape: true, trimBlocks: true, lstripBlocks: true },
  );

  const translations = loadTranslations(locale);
  const englishFallback =
    locale === 'en' ? translations : loadTranslations('en');

  env.addFilter('t', (key: string, overrideLocale?: string): string => {
    const t = overrideLocale ? loadTranslations(overrideLocale) : translations;
    return t[key] ?? englishFallback[key] ?? key;
  });

  env.addFilter(
    'barcode',
    (
      value: string,
      typeOrCallback: string | BarcodeCallback,
      heightOrCallback?: number | BarcodeCallback,
      maybeCallback?: BarcodeCallback,
    ) => {
      let type: string = 'code128';
      let height: number = 40;
      let callback: BarcodeCallback;

      if (typeof typeOrCallback === 'function') {
        callback = typeOrCallback;
      } else if (typeof heightOrCallback === 'function') {
        type = typeOrCallback;
        callback = heightOrCallback;
      } else if (typeof maybeCallback === 'function') {
        type = typeOrCallback;
        height = heightOrCallback as number;
        callback = maybeCallback;
      } else {
        return;
      }

      const escapedValue = htmlEscape(value);
      const fallback = new nunjucks.runtime.SafeString(
        `<span class="barcode-fallback">${escapedValue}</span>`,
      );

      try {
        bwipjs.toBuffer(
          {
            bcid: type,
            text: String(value),
            height,
            includetext: true,
            textxalign: 'center',
          },
          (err: Error | string | null, png: Buffer) => {
            if (err || !png) {
              logger.error({ err }, 'Barcode generation failed');
              callback(null, fallback);
              return;
            }
            const base64 = png.toString('base64');
            callback(
              null,
              new nunjucks.runtime.SafeString(
                `<img src="data:image/png;base64,${base64}" alt="${escapedValue}" style="display:block;" />`,
              ),
            );
          },
        );
      } catch (err) {
        logger.error({ err }, 'Barcode generation failed');
        callback(null, fallback);
      }
    },
    true,
  );

  env.addFilter(
    'qrcode',
    (value: string, size: number = 120): nunjucks.runtime.SafeString => {
      if (!value) return new nunjucks.runtime.SafeString('');
      try {
        const qr = new QRCodeSVG({
          content: String(value),
          width: size,
          height: size,
          container: 'svg-viewbox',
          join: true,
          pretty: false,
        });
        const svg = qr.svg().replace(/^<\?xml[^?]*\?>\s*/, '');
        return new nunjucks.runtime.SafeString(svg);
      } catch (err) {
        logger.error({ err }, 'QR code generation failed');
        return new nunjucks.runtime.SafeString(
          `<span class="qrcode-fallback">${htmlEscape(value)}</span>`,
        );
      }
    },
  );

  env.addFilter('dateFormat', (value: string): string => {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return value ?? '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.toLocaleDateString(locale, { month: 'long' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return value ?? '';
    }
  });

  env.addFilter('age', (birthDate: string): string => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return '';
    const now = new Date();
    const days = Math.floor(
      (now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24),
    );
    const monthsRaw =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    const months = monthsRaw - (now.getDate() >= birth.getDate() ? 0 : 1);
    const years = Math.floor(months / 12);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
    if (months < 24) return `${months} month${months !== 1 ? 's' : ''}`;
    return `${years} year${years !== 1 ? 's' : ''}`;
  });

  env.addFilter(
    'fhirpathEvaluate',
    (resource: unknown, expr: string): unknown => {
      return evaluateFhirPath(resource, expr);
    },
  );

  env.addFilter('round', (value: number, decimals: number = 0): string => {
    if (value == null || isNaN(value)) return '';
    return value.toFixed(decimals);
  });

  return env;
}

export function render(
  templatePath: string,
  computed: Record<string, unknown>,
  locale: string,
  stylesheetPath?: string,
  dataContext: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
): Promise<string> {
  const env = createEnvironment(locale);

  return new Promise((resolve, reject) => {
    env.render(
      templatePath,
      {
        ...dataContext,
        computed,
        data,
        locale,
        now: new Date(),
      },
      (err, html) => {
        if (err) {
          reject(err);
          return;
        }
        let result = html ?? '';
        if (stylesheetPath && fs.existsSync(stylesheetPath)) {
          const css = fs.readFileSync(stylesheetPath, 'utf-8');
          const tag = `<style>\n${css}\n</style>`;
          result = result.includes('</head>')
            ? result.replace('</head>', `${tag}\n</head>`)
            : `${tag}\n${result}`;
        }
        resolve(result);
      },
    );
  });
}
