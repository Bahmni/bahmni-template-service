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

import { AssetService } from './assetService';

// 1×1 red pixel PNG (minimal valid PNG)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

// 1×1 white pixel JPEG (minimal valid JPEG)
const TINY_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
  'base64',
);

// Minimal valid SVG
const TINY_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
);

let tmpDir: string;
let assetsDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-service-test-'));
  assetsDir = path.join(tmpDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'logo.png'), TINY_PNG);
  fs.writeFileSync(path.join(assetsDir, 'photo.jpg'), TINY_JPG);
  fs.writeFileSync(path.join(assetsDir, 'photo.jpeg'), TINY_JPG);
  fs.writeFileSync(path.join(assetsDir, 'icon.svg'), TINY_SVG);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('AssetService', () => {
  let service: AssetService;

  beforeEach(() => {
    service = new AssetService(tmpDir);
  });

  describe('toDataUri — supported types', () => {
    it('converts PNG file to a valid data URI', () => {
      const uri = service.toDataUri('logo.png');
      expect(uri).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    });

    it('converts JPG file to a valid data URI', () => {
      const uri = service.toDataUri('photo.jpg');
      expect(uri).toMatch(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);
    });

    it('converts JPEG file to a valid data URI', () => {
      const uri = service.toDataUri('photo.jpeg');
      expect(uri).toMatch(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);
    });

    it('converts SVG file to a valid data URI', () => {
      const uri = service.toDataUri('icon.svg');
      expect(uri).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    });

    it('returns a non-empty base64 payload', () => {
      const uri = service.toDataUri('logo.png');
      const [, payload] = uri.split(',');
      expect(payload.length).toBeGreaterThan(0);
    });
  });

  describe('toDataUri — error cases', () => {
    it('throws a descriptive error when input is undefined', () => {
      expect(() => service.toDataUri(undefined)).toThrow(
        'asset filter expects a quoted string filename',
      );
    });

    it('throws a descriptive error when input is a number', () => {
      expect(() => service.toDataUri(42)).toThrow(
        'asset filter expects a quoted string filename',
      );
    });

    it('throws a descriptive error when input is null', () => {
      expect(() => service.toDataUri(null)).toThrow(
        'asset filter expects a quoted string filename',
      );
    });

    it('throws on an unsupported file extension', () => {
      expect(() => service.toDataUri('style.css')).toThrow(
        'Unsupported asset type: .css',
      );
    });

    it('throws when the file does not exist', () => {
      expect(() => service.toDataUri('nonexistent.png')).toThrow();
    });
  });
});
