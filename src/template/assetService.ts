/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import fs from 'fs';
import path from 'path';

import { ASSETS_DIR, SUPPORTED_IMAGE_MIME_TYPES } from '../constants';

export class AssetService {
  private readonly assetsDir: string;

  constructor(templatesDir: string) {
    this.assetsDir = path.join(templatesDir, ASSETS_DIR);
  }

  toDataUri(relativePath: unknown): string {
    if (typeof relativePath !== 'string') {
      throw new Error(
        `asset filter expects a quoted string filename, got: ${typeof relativePath}. ` +
          `Use {{ 'filename.png' | asset }}`,
      );
    }

    const filePath = path.join(this.assetsDir, relativePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = SUPPORTED_IMAGE_MIME_TYPES[ext];

    if (!mime) {
      throw new Error(`Unsupported asset type: ${ext}`);
    }

    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  }
}
