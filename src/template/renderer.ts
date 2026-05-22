/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { HTTP_STATUS } from '../constants';
import { AppError } from '../errors';
import { fileExists, readTextFile } from '../fileSystem';
import { createEnvironment } from './nunjucksEnv';

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
          reject(new AppError(err.message, HTTP_STATUS.INTERNAL_SERVER_ERROR));
          return;
        }
        try {
          let result = html ?? '';
          if (stylesheetPath && fileExists(stylesheetPath)) {
            const css = readTextFile(stylesheetPath);
            const tag = `<style>\n${css}\n</style>`;
            result = result.includes('</head>')
              ? result.replace('</head>', `${tag}\n</head>`)
              : `${tag}\n${result}`;
          }
          resolve(result);
        } catch (e) {
          reject(e);
        }
      },
    );
  });
}
