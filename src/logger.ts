const LEVELS = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 } as const;

type Level = keyof typeof LEVELS;

const minLevel: number = LEVELS[(process.env.LOG_LEVEL ?? 'info') as Level] ?? LEVELS.info;

function log(level: Level, objOrMsg: unknown, msg?: string): void {
  if (LEVELS[level] < minLevel) return;
  const entry =
    msg !== undefined
      ? { level, ...(objOrMsg !== null && typeof objOrMsg === 'object' ? objOrMsg : {}), msg }
      : { level, msg: String(objOrMsg) };
  console.log(JSON.stringify(entry));
}

const logger = {
  trace: (objOrMsg: unknown, msg?: string) => log('trace', objOrMsg, msg),
  debug: (objOrMsg: unknown, msg?: string) => log('debug', objOrMsg, msg),
  info:  (objOrMsg: unknown, msg?: string) => log('info',  objOrMsg, msg),
  warn:  (objOrMsg: unknown, msg?: string) => log('warn',  objOrMsg, msg),
  error: (objOrMsg: unknown, msg?: string) => log('error', objOrMsg, msg),
  fatal: (objOrMsg: unknown, msg?: string) => log('fatal', objOrMsg, msg),
};

export default logger;
