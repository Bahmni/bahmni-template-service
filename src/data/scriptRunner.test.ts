/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { AppError, ValidationError } from '../errors';
import { _resetTranslationCacheForTests } from '../template/translations';
import { runComputeScript } from './scriptRunner';

function writeScript(dir: string, name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

describe('runComputeScript', () => {
  let tempDir: string;
  let prevTemplatesDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-'));
    prevTemplatesDir = process.env.TEMPLATES_DIR;
    process.env.TEMPLATES_DIR = tempDir;
  });

  afterEach(() => {
    if (prevTemplatesDir === undefined) delete process.env.TEMPLATES_DIR;
    else process.env.TEMPLATES_DIR = prevTemplatesDir;
    fs.rmSync(tempDir, { recursive: true, force: true });
    _resetTranslationCacheForTests();
  });

  it('returns the object from compute()', async () => {
    const scriptPath = writeScript(
      tempDir,
      'ok.js',
      `module.exports = { compute: async () => ({ name: 'Alice', age: 30 }) };`,
    );
    expect(await runComputeScript(scriptPath, {})).toEqual({
      name: 'Alice',
      age: 30,
    });
  });

  it('can be called multiple times with the same script path without errors', async () => {
    const scriptPath = writeScript(
      tempDir,
      'multi.js',
      `module.exports = { compute: async () => ({ ok: true }) };`,
    );
    for (let i = 0; i < 3; i++) {
      expect(await runComputeScript(scriptPath, {})).toEqual({ ok: true });
    }
  });

  it('re-throws ValidationError from compute()', async () => {
    const scriptPath = writeScript(
      tempDir,
      'validate.js',
      `module.exports = {
         compute: ({ ValidationError }) => { throw new ValidationError('bad input'); }
       };`,
    );
    await expect(runComputeScript(scriptPath, {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(runComputeScript(scriptPath, {})).rejects.toThrow('bad input');
  });

  it('throws AppError(500) when compute() throws a non-ValidationError', async () => {
    const scriptPath = writeScript(
      tempDir,
      'crash.js',
      `module.exports = { compute: () => { throw new TypeError('oops'); } };`,
    );
    const err = await runComputeScript(scriptPath, {}).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(500);
  });

  it('returns {} when compute is not exported', async () => {
    const scriptPath = writeScript(
      tempDir,
      'noexport.js',
      `module.exports = {};`,
    );
    expect(await runComputeScript(scriptPath, {})).toEqual({});
  });

  it('returns {} when compute() returns null', async () => {
    const scriptPath = writeScript(
      tempDir,
      'null.js',
      `module.exports = { compute: () => null };`,
    );
    expect(await runComputeScript(scriptPath, {})).toEqual({});
  });

  it('returns {} when compute() returns an array', async () => {
    const scriptPath = writeScript(
      tempDir,
      'array.js',
      `module.exports = { compute: () => ['a', 'b'] };`,
    );
    expect(await runComputeScript(scriptPath, {})).toEqual({});
  });

  describe('translate helper', () => {
    it('returns translated value for request locale', async () => {
      fs.mkdirSync(path.join(tempDir, '_i18n'));
      fs.writeFileSync(
        path.join(tempDir, '_i18n', 'fr.json'),
        JSON.stringify({ HELLO: 'Bonjour' }),
      );
      const scriptPath = writeScript(
        tempDir,
        'trans.js',
        `module.exports = { compute: ({ translate }) => ({ label: translate('HELLO') }) };`,
      );
      expect(
        await runComputeScript(scriptPath, {}, undefined, undefined, 'fr'),
      ).toEqual({ label: 'Bonjour' });
    });

    it('falls back to English when key is missing in request locale', async () => {
      fs.mkdirSync(path.join(tempDir, '_i18n'));
      fs.writeFileSync(
        path.join(tempDir, '_i18n', 'en.json'),
        JSON.stringify({ HELLO: 'Hello' }),
      );
      fs.writeFileSync(
        path.join(tempDir, '_i18n', 'fr.json'),
        JSON.stringify({}),
      );
      const scriptPath = writeScript(
        tempDir,
        'fallback.js',
        `module.exports = { compute: ({ translate }) => ({ label: translate('HELLO') }) };`,
      );
      expect(
        await runComputeScript(scriptPath, {}, undefined, undefined, 'fr'),
      ).toEqual({ label: 'Hello' });
    });

    it('falls back to raw key when missing in all locales', async () => {
      const scriptPath = writeScript(
        tempDir,
        'rawkey.js',
        `module.exports = { compute: ({ translate }) => ({ label: translate('MISSING') }) };`,
      );
      expect(await runComputeScript(scriptPath, {})).toEqual({
        label: 'MISSING',
      });
    });

    it('uses overrideLocale when specified', async () => {
      fs.mkdirSync(path.join(tempDir, '_i18n'));
      fs.writeFileSync(
        path.join(tempDir, '_i18n', 'en.json'),
        JSON.stringify({ HELLO: 'Hello' }),
      );
      fs.writeFileSync(
        path.join(tempDir, '_i18n', 'fr.json'),
        JSON.stringify({ HELLO: 'Bonjour' }),
      );
      const scriptPath = writeScript(
        tempDir,
        'override.js',
        `module.exports = {
           compute: ({ translate }) => ({
             en: translate('HELLO', 'en'),
             fr: translate('HELLO', 'fr'),
           })
         };`,
      );
      const result = await runComputeScript(
        scriptPath,
        {},
        undefined,
        undefined,
        'en',
      );
      expect(result).toEqual({ en: 'Hello', fr: 'Bonjour' });
    });
  });
});
