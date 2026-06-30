import { Request, Response } from 'express';

import { PDF_ENABLED } from '../config';
import { isPdfPoolReady } from '../pdf/pdfPool';

export function healthCheck(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    chromium: PDF_ENABLED ? isPdfPoolReady() : false,
  });
}
