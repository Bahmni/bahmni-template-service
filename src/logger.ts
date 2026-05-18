/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

const LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
} as const;

type Level = keyof typeof LEVELS;

const minLevel: number =
  LEVELS[(process.env.LOG_LEVEL ?? 'info') as Level] ?? LEVELS.info;

function log(level: Level, objOrMsg: unknown, msg?: string): void {
  if (LEVELS[level] < minLevel) return;
  const entry =
    msg !== undefined
      ? {
          level,
          ...(objOrMsg !== null && typeof objOrMsg === 'object'
            ? objOrMsg
            : {}),
          msg,
        }
      : { level, msg: String(objOrMsg) };
  console.log(JSON.stringify(entry)); // eslint-disable-line no-console
}

const logger = {
  trace: (objOrMsg: unknown, msg?: string) => log('trace', objOrMsg, msg),
  debug: (objOrMsg: unknown, msg?: string) => log('debug', objOrMsg, msg),
  info: (objOrMsg: unknown, msg?: string) => log('info', objOrMsg, msg),
  warn: (objOrMsg: unknown, msg?: string) => log('warn', objOrMsg, msg),
  error: (objOrMsg: unknown, msg?: string) => log('error', objOrMsg, msg),
  fatal: (objOrMsg: unknown, msg?: string) => log('fatal', objOrMsg, msg),
};

export default logger;
