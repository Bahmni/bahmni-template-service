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

import { render } from './renderer';
import { _resetTranslationCacheForTests } from './translations';

function withTempTemplates(files: Record<string, string>): {
  dir: string;
  cleanup: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmpl-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
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

describe('renderer', () => {
  describe('stylesheet injection', () => {
    it('injects <style> block before </head> when the template has a head element', async () => {
      const t = withTempTemplates({
        'demo/template.html': '<html><head></head><body>hello</body></html>',
        'demo/styles.css': 'body { color: red; }',
      });
      try {
        const cssPath = path.join(t.dir, 'demo', 'styles.css');
        const html = await render('demo/template.html', {}, 'en', cssPath);
        expect(html).toContain('<style>');
        expect(html).toContain('body { color: red; }');
        expect(html.indexOf('<style>')).toBeLessThan(html.indexOf('</head>'));
      } finally {
        t.cleanup();
      }
    });

    it('prepends <style> block when the template has no </head>', async () => {
      const t = withTempTemplates({
        'demo/template.html': '<p>hello</p>',
        'demo/styles.css': 'p { color: blue; }',
      });
      try {
        const cssPath = path.join(t.dir, 'demo', 'styles.css');
        const html = await render('demo/template.html', {}, 'en', cssPath);
        expect(html).toContain('<style>');
        expect(html).toContain('p { color: blue; }');
        expect(html).toMatch(/^<style>/);
      } finally {
        t.cleanup();
      }
    });

    it('skips injection when stylesheetPath is undefined', async () => {
      const t = withTempTemplates({
        'demo/template.html': '<html><head></head><body>hello</body></html>',
      });
      try {
        const html = await render('demo/template.html', {}, 'en');
        expect(html).not.toContain('<style>');
      } finally {
        t.cleanup();
      }
    });
  });

  describe('barcode filter', () => {
    it('emits a real PNG data URL (regression test for bwip-js v3 Promise bug)', async () => {
      const t = withTempTemplates({
        'demo/template.html': `{{ computed.value | barcode('code128', 40) }}`,
      });
      try {
        const html = await render(
          'demo/template.html',
          { value: 'ABC-123' },
          'en',
        );
        expect(html).toMatch(/<img src="data:image\/png;base64,/);
        const m = html.match(/base64,([A-Za-z0-9+/=]+)"/);
        expect(m).not.toBeNull();
        const b64 = m![1];
        const buf = Buffer.from(b64, 'base64');
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4e);
        expect(buf[3]).toBe(0x47);
      } finally {
        t.cleanup();
      }
    });

    it('falls back to a span when barcode generation fails', async () => {
      const t = withTempTemplates({
        'demo/template.html': `{{ computed.value | barcode('not-a-real-bcid', 40) }}`,
      });
      try {
        const html = await render('demo/template.html', { value: 'X' }, 'en');
        expect(html).toContain('<span class="barcode-fallback">X</span>');
      } finally {
        t.cleanup();
      }
    });
  });

  describe('translation cache', () => {
    it('reflects edits to the i18n file (mtime-based invalidation)', async () => {
      const t = withTempTemplates({
        '_i18n/en.json': JSON.stringify({ HELLO: 'Hi' }),
        'demo/template.html': `{{ 'HELLO' | t }}`,
      });
      try {
        const first = await render('demo/template.html', {}, 'en');
        expect(first.trim()).toBe('Hi');

        const newPath = path.join(t.dir, '_i18n', 'en.json');
        fs.writeFileSync(newPath, JSON.stringify({ HELLO: 'Howdy' }));
        const future = new Date(Date.now() + 2000);
        fs.utimesSync(newPath, future, future);

        const second = await render('demo/template.html', {}, 'en');
        expect(second.trim()).toBe('Howdy');
      } finally {
        t.cleanup();
      }
    });

    it('falls back to the raw key when no translation file exists', async () => {
      const t = withTempTemplates({
        'demo/template.html': `{{ 'MISSING_KEY' | t }}`,
      });
      try {
        const html = await render('demo/template.html', {}, 'en');
        expect(html.trim()).toBe('MISSING_KEY');
      } finally {
        t.cleanup();
      }
    });
  });
});
