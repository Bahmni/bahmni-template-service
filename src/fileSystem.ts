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
import { FILE_ENCODING } from './constants';
import { AppError } from './errors';

export type FileStat = Pick<fs.Stats, 'mtimeMs'>;

export function statFile(filePath: string): FileStat | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

export function readTextFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, FILE_ENCODING);
  } catch {
    throw new AppError(`Failed to read file: ${path.basename(filePath)}`, 500);
  }
}

export function readJsonFile<T>(filePath: string): T {
  try {
    return JSON.parse(readTextFile(filePath)) as T;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Failed to parse file: ${path.basename(filePath)}`, 500);
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function safePath(root: string, subPath: string): string | null {
  const normalizedRoot = root.endsWith(path.sep) ? root : root + path.sep;
  const resolved = path.resolve(root, subPath);
  return resolved.startsWith(normalizedRoot) ? resolved : null;
}

export { join as joinPath, resolve as resolvePath } from 'path';
