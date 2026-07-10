/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import type { Browser, Page } from 'playwright';

import { DEFAULT_MAX_CONCURRENT_PDF, HTTP_STATUS } from '../constants';
import { AppError, PdfNotSupportedError } from '../errors';
import logger from '../logger';

export interface PageSettings {
  paperSize?: string;
  orientation?: 'portrait' | 'landscape';
}

let browser: Browser | null = null;
let pagePool: Page[] = [];
let waitQueue: Array<(page: Page) => void> = [];

/**
 * Initialise the Playwright browser and pre-warm a pool of reusable pages.
 * Must be called once at server startup when PDF_ENABLED=true.
 *
 * @param maxConcurrent - Number of pages to keep in the pool (default: DEFAULT_MAX_CONCURRENT_PDF)
 */
export async function initPdfPool(
  maxConcurrent: number = DEFAULT_MAX_CONCURRENT_PDF,
): Promise<void> {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new PdfNotSupportedError();
  }
  try {
    browser = await chromium.launch({
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    for (let i = 0; i < maxConcurrent; i++) {
      pagePool.push(await browser.newPage());
    }
  } catch (error) {
    logger.error({ err: error }, 'PDF pool initialisation failed');
    throw new PdfNotSupportedError();
  }
}

function acquirePage(): Promise<Page> {
  if (pagePool.length > 0) {
    return Promise.resolve(pagePool.pop()!);
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releasePage(page: Page): void {
  if (waitQueue.length > 0) {
    waitQueue.shift()!(page);
  } else {
    pagePool.push(page);
  }
}

/**
 * Convert an HTML string to a PDF buffer using a pooled Playwright page.
 * The page is acquired from the pool (waiting if all are busy) and released
 * back when rendering is complete.
 *
 * @param html - Fully-rendered HTML string
 * @param pageSettings - Optional paper size and orientation overrides
 * @returns PDF as a Node.js Buffer
 * @throws if the pool has not been initialised via {@link initPdfPool}
 */
export async function convertToPdf(
  html: string,
  pageSettings: PageSettings = {},
): Promise<Buffer> {
  if (!browser) {
    throw new AppError(
      'PDF generation is not supported.',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
    );
  }

  const page = await acquirePage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBytes = await page.pdf({
      format: pageSettings.paperSize ?? 'A4',
      landscape: pageSettings.orientation === 'landscape',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdfBytes);
  } catch (err) {
    logger.error({ err }, 'PDF generation failed');
    throw err;
  } finally {
    releasePage(page);
  }
}

/**
 * Returns true when the pool has been successfully initialised and the
 * Chromium browser process is running.
 */
export function isPdfPoolReady(): boolean {
  return browser !== null;
}

/**
 * Gracefully close the browser and reset pool state.
 * Should be called during server shutdown.
 */
export async function shutdownPdfPool(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    pagePool = [];
    waitQueue = [];
  }
}
