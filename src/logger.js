const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[configuredLevel] ?? LEVELS.info;

function log(level, message, extra) {
  if (LEVELS[level] > threshold) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...extra,
  };

  const out = level === 'error' ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + '\n');
}

const logger = {
  error: (msg, extra) => log('error', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  info: (msg, extra) => log('info', msg, extra),
  debug: (msg, extra) => log('debug', msg, extra),
};

export default logger;
