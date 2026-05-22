/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { templatesDir } from '../config';
import { DEFAULT_LOCALE, I18N_DIR } from '../constants';
import { joinPath, readJsonFile, statFile } from '../fileSystem';

interface TranslationCacheEntry {
  mtimeMs: number;
  value: Record<string, string>;
}

const translationCache = new Map<string, TranslationCacheEntry>();

export function loadTranslations(locale: string): Record<string, string> {
  const filePath = joinPath(templatesDir(), I18N_DIR, `${locale}.json`);

  const stat = statFile(filePath);
  if (!stat) {
    translationCache.delete(filePath);
    return {};
  }

  try {
    const cached = translationCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }
    const value = readJsonFile<Record<string, string>>(filePath);
    translationCache.set(filePath, { mtimeMs: stat.mtimeMs, value });
    return value;
  } catch {
    translationCache.delete(filePath);
    return {};
  }
}

export type TranslateFn = (key: string, overrideLocale?: string) => string;

export function createTranslator(locale: string): TranslateFn {
  return (key, overrideLocale) => {
    const targetLocale = overrideLocale ?? locale;
    const t = loadTranslations(targetLocale);
    const fallback =
      targetLocale === DEFAULT_LOCALE ? t : loadTranslations(DEFAULT_LOCALE);
    return t[key] ?? fallback[key] ?? key;
  };
}

export function _resetTranslationCacheForTests(): void {
  translationCache.clear();
}
