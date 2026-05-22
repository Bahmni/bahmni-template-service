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
import * as fileSystem from '../fileSystem';
import { templateStore } from './store';

function setupTemplatesDir(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tstore-'));
  const prev = process.env.TEMPLATES_DIR;
  process.env.TEMPLATES_DIR = dir;
  return {
    dir,
    cleanup: () => {
      if (prev === undefined) delete process.env.TEMPLATES_DIR;
      else process.env.TEMPLATES_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('templateStore', () => {
  beforeEach(() => {
    templateStore.clearCache();
  });

  it('returns [] when templates.json does not exist', () => {
    const t = setupTemplatesDir();
    try {
      expect(templateStore.list()).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it('caches templates.json and serves from cache when mtime is unchanged', () => {
    const t = setupTemplatesDir();
    try {
      const registryPath = path.join(t.dir, 'templates.json');
      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          templates: [
            {
              id: 'A',
              name: 'A',
              folder: 'a',
            },
          ],
        }),
      );

      const first = templateStore.list();
      expect(first).toHaveLength(1);

      const readSpy = jest.spyOn(fileSystem, 'readTextFile');

      const second = templateStore.list();
      expect(second).toHaveLength(1);
      expect(readSpy.mock.calls).toHaveLength(0);

      readSpy.mockRestore();
    } finally {
      t.cleanup();
    }
  });

  it('invalidates the cache when templates.json mtime changes', () => {
    const t = setupTemplatesDir();
    try {
      const registryPath = path.join(t.dir, 'templates.json');
      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          templates: [
            {
              id: 'A',
              name: 'A',
              folder: 'a',
            },
          ],
        }),
      );

      expect(templateStore.list().map((x) => x.id)).toEqual(['A']);

      fs.writeFileSync(
        registryPath,
        JSON.stringify({
          templates: [
            {
              id: 'A',
              name: 'A',
              folder: 'a',
            },
            {
              id: 'B',
              name: 'B',
              folder: 'b',
            },
          ],
        }),
      );
      const future = new Date(Date.now() + 2000);
      fs.utimesSync(registryPath, future, future);

      expect(templateStore.list().map((x) => x.id)).toEqual(['A', 'B']);
    } finally {
      t.cleanup();
    }
  });

  it('returns null when the requested template id is not registered', () => {
    const t = setupTemplatesDir();
    try {
      fs.writeFileSync(
        path.join(t.dir, 'templates.json'),
        JSON.stringify({ templates: [] }),
      );
      expect(templateStore.get('NOPE')).toBeNull();
    } finally {
      t.cleanup();
    }
  });

  it('loads a template with template.html', () => {
    const t = setupTemplatesDir();
    try {
      fs.writeFileSync(
        path.join(t.dir, 'templates.json'),
        JSON.stringify({
          templates: [
            {
              id: 'PRESCRIPTION',
              name: 'Prescription',
              folder: 'rx',
            },
          ],
        }),
      );
      fs.mkdirSync(path.join(t.dir, 'rx'));
      fs.writeFileSync(path.join(t.dir, 'rx', 'template.html'), '<p>ok</p>');

      const loaded = templateStore.get('PRESCRIPTION');
      expect(loaded).not.toBeNull();
      expect(loaded!.templatePath).toBe('rx/template.html');
      expect(loaded!.computeScriptPath).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it('returns null when template.html is missing on disk', () => {
    const t = setupTemplatesDir();
    try {
      fs.writeFileSync(
        path.join(t.dir, 'templates.json'),
        JSON.stringify({
          templates: [{ id: 'A', name: 'A', folder: 'a' }],
        }),
      );
      fs.mkdirSync(path.join(t.dir, 'a'));

      expect(templateStore.get('A')).toBeNull();
    } finally {
      t.cleanup();
    }
  });

  it('returns null for a template with a path-traversal folder', () => {
    const t = setupTemplatesDir();
    try {
      fs.writeFileSync(
        path.join(t.dir, 'templates.json'),
        JSON.stringify({
          templates: [{ id: 'ESCAPE', name: 'Escape', folder: '../escape' }],
        }),
      );
      expect(templateStore.get('ESCAPE')).toBeNull();
    } finally {
      t.cleanup();
    }
  });

  it('returns [] and logs an error when templates.json contains malformed JSON', () => {
    const t = setupTemplatesDir();
    try {
      fs.writeFileSync(
        path.join(t.dir, 'templates.json'),
        '{ not valid json }',
      );
      expect(templateStore.list()).toEqual([]);
    } finally {
      t.cleanup();
    }
  });
});
