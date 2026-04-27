import createApp from './app.js';
import config from './config.js';
import { templateService } from './routes/templates.js';
import { init as initPdfPool, shutdown as shutdownPdfPool, isReady as isPdfReady } from './services/pdf-pool.js';

const app = createApp({
  healthProvider: () => ({
    status: 'ok',
    templates: templateService.listTemplates().length,
    chromium: isPdfReady(),
    uptime: Math.round(process.uptime()),
  }),
});

async function start() {
  await initPdfPool(config.maxConcurrentPdf);
  console.log(`PDF pool initialized (concurrency: ${config.maxConcurrentPdf})`);

  return app.listen(config.port, () => {
    console.log(`Template service listening on port ${config.port}`);
  });
}

const server = await start();

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close();
  try {
    await shutdownPdfPool();
  } catch {
    // pdf-pool may not be initialized
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
