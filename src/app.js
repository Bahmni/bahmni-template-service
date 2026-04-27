import express from 'express';
import renderRoutes from './routes/render.js';
import templateRoutes from './routes/templates.js';

export default function createApp({ healthProvider } = {}) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (req, res) => {
    try {
      const health = healthProvider ? healthProvider() : { status: 'ok' };
      res.json(health);
    } catch {
      res.json({ status: 'ok' });
    }
  });

  app.use('/template-service/api/v1/render', renderRoutes);
  app.use('/template-service/api/v1/templates', templateRoutes);

  return app;
}
