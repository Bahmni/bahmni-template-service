import { Request, Response } from 'express';

import { isPdfPoolReady } from '../pdf/pdfPool';
import { PDF_ENABLED } from '../config';

export function healthCheck(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    chromium: PDF_ENABLED ? isPdfPoolReady() : false,
  });
}
