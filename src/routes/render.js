import { Router } from 'express';
import RenderService from '../services/render-service.js';
import { ValidationError, TemplateNotFoundError, TemplateDisabledError, DataFetchError } from '../errors.js';
import logger from '../logger.js';

const router = Router();
const renderService = new RenderService();

router.post('/', async (req, res) => {
  const { templateId, format, locale } = req.body;
  logger.info('Render request received', { templateId, format, locale, method: req.method, url: req.originalUrl });

  try {
    const result = await renderService.render({
      ...req.body,
      sessionCookie: extractSessionCookie(req.headers.cookie),
    });

    logger.info('Render completed', { templateId, format: result.type });

    if (result.type === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
      return res.send(result.body);
    }

    if (result.type === 'email') {
      return res.json(result.body);
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(result.body);
  } catch (err) {
    const status = errorToStatus(err);
    logger.error('Render failed', { templateId, status, error: err.message });
    res.status(status).json({ error: err.message });
  }
});

function extractSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)reporting_session=([^;]*)/);
  return match ? match[1] : null;
}

function errorToStatus(err) {
  if (err instanceof ValidationError) return 400;
  if (err instanceof TemplateNotFoundError) return 404;
  if (err instanceof TemplateDisabledError) return 404;
  if (err instanceof DataFetchError) return 502;
  return 500;
}

export default router;
