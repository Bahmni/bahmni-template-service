import fs from 'fs';
import os from 'os';
import path from 'path';
import { AppError, ValidationError } from '../errors';
import { _resetTranslationCacheForTests } from '../template/renderer';
import { runComputeScript } from './scriptRunner';

function setupEnv(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-'));
  const prev = process.env.TEMPLATES_DIR;
  process.env.TEMPLATES_DIR = dir;
  return {
    dir,
    cleanup: () => {
      if (prev === undefined) delete process.env.TEMPLATES_DIR;
      else process.env.TEMPLATES_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
      _resetTranslationCacheForTests();
    },
  };
}

function writeScript(dir: string, name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

describe('runComputeScript', () => {
  it('returns the object from compute()', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'ok.js',
        `
        module.exports = { compute: async () => ({ name: 'Alice', age: 30 }) };
      `,
      );
      expect(await runComputeScript(scriptPath, {})).toEqual({
        name: 'Alice',
        age: 30,
      });
    } finally {
      env.cleanup();
    }
  });

  it('can be called multiple times with the same script path without errors', async () => {
    // Jest's IDs differ from require.cache keys so hot-reload cannot be exercised here.
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'multi.js',
        `
        module.exports = { compute: async () => ({ ok: true }) };
      `,
      );
      for (let i = 0; i < 3; i++) {
        expect(await runComputeScript(scriptPath, {})).toEqual({ ok: true });
      }
    } finally {
      env.cleanup();
    }
  });

  it('re-throws ValidationError from compute()', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'validate.js',
        `
        module.exports = {
          compute: ({ ValidationError }) => { throw new ValidationError('bad input'); }
        };
      `,
      );
      await expect(runComputeScript(scriptPath, {})).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(runComputeScript(scriptPath, {})).rejects.toThrow(
        'bad input',
      );
    } finally {
      env.cleanup();
    }
  });

  it('throws AppError(500) when compute() throws a non-ValidationError', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'crash.js',
        `
        module.exports = { compute: () => { throw new TypeError('oops'); } };
      `,
      );
      const err = await runComputeScript(scriptPath, {}).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(500);
    } finally {
      env.cleanup();
    }
  });

  it('returns {} when compute is not exported', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'noexport.js',
        `module.exports = {};`,
      );
      expect(await runComputeScript(scriptPath, {})).toEqual({});
    } finally {
      env.cleanup();
    }
  });

  it('returns {} when compute() returns null', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'null.js',
        `
        module.exports = { compute: () => null };
      `,
      );
      expect(await runComputeScript(scriptPath, {})).toEqual({});
    } finally {
      env.cleanup();
    }
  });

  it('returns {} when compute() returns an array', async () => {
    const env = setupEnv();
    try {
      const scriptPath = writeScript(
        env.dir,
        'array.js',
        `
        module.exports = { compute: () => ['a', 'b'] };
      `,
      );
      expect(await runComputeScript(scriptPath, {})).toEqual({});
    } finally {
      env.cleanup();
    }
  });

  describe('translate helper', () => {
    it('returns translated value for request locale', async () => {
      const env = setupEnv();
      try {
        fs.mkdirSync(path.join(env.dir, '_i18n'));
        fs.writeFileSync(
          path.join(env.dir, '_i18n', 'fr.json'),
          JSON.stringify({ HELLO: 'Bonjour' }),
        );
        const scriptPath = writeScript(
          env.dir,
          'trans.js',
          `
          module.exports = { compute: ({ translate }) => ({ label: translate('HELLO') }) };
        `,
        );
        expect(
          await runComputeScript(scriptPath, {}, undefined, undefined, 'fr'),
        ).toEqual({
          label: 'Bonjour',
        });
      } finally {
        env.cleanup();
      }
    });

    it('falls back to English when key is missing in request locale', async () => {
      const env = setupEnv();
      try {
        fs.mkdirSync(path.join(env.dir, '_i18n'));
        fs.writeFileSync(
          path.join(env.dir, '_i18n', 'en.json'),
          JSON.stringify({ HELLO: 'Hello' }),
        );
        fs.writeFileSync(
          path.join(env.dir, '_i18n', 'fr.json'),
          JSON.stringify({}),
        );
        const scriptPath = writeScript(
          env.dir,
          'fallback.js',
          `
          module.exports = { compute: ({ translate }) => ({ label: translate('HELLO') }) };
        `,
        );
        expect(
          await runComputeScript(scriptPath, {}, undefined, undefined, 'fr'),
        ).toEqual({
          label: 'Hello',
        });
      } finally {
        env.cleanup();
      }
    });

    it('falls back to raw key when missing in all locales', async () => {
      const env = setupEnv();
      try {
        const scriptPath = writeScript(
          env.dir,
          'rawkey.js',
          `
          module.exports = { compute: ({ translate }) => ({ label: translate('MISSING') }) };
        `,
        );
        expect(await runComputeScript(scriptPath, {})).toEqual({
          label: 'MISSING',
        });
      } finally {
        env.cleanup();
      }
    });

    it('uses overrideLocale when specified', async () => {
      const env = setupEnv();
      try {
        fs.mkdirSync(path.join(env.dir, '_i18n'));
        fs.writeFileSync(
          path.join(env.dir, '_i18n', 'en.json'),
          JSON.stringify({ HELLO: 'Hello' }),
        );
        fs.writeFileSync(
          path.join(env.dir, '_i18n', 'fr.json'),
          JSON.stringify({ HELLO: 'Bonjour' }),
        );
        const scriptPath = writeScript(
          env.dir,
          'override.js',
          `
          module.exports = {
            compute: ({ translate }) => ({
              en: translate('HELLO', 'en'),
              fr: translate('HELLO', 'fr'),
            })
          };
        `,
        );
        const result = await runComputeScript(
          scriptPath,
          {},
          undefined,
          undefined,
          'en',
        );
        expect(result).toEqual({ en: 'Hello', fr: 'Bonjour' });
      } finally {
        env.cleanup();
      }
    });
  });
});
