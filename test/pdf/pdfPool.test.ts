/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import {
  convertToPdf,
  initPdfPool,
  isPdfPoolReady,
  shutdownPdfPool,
} from '../../src/pdf/pdfPool';

const mockPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
const mockSetContent = jest.fn().mockResolvedValue(undefined);
const mockNewPage = jest.fn().mockImplementation(() =>
  Promise.resolve({
    setContent: mockSetContent,
    pdf: mockPdf,
  }),
);
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockLaunch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    newPage: mockNewPage,
    close: mockClose,
  }),
);

jest.mock('playwright', () => ({
  chromium: { launch: mockLaunch },
}));

async function resetPool(): Promise<void> {
  await shutdownPdfPool();
  jest.clearAllMocks();
  mockPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
  mockSetContent.mockResolvedValue(undefined);
  mockNewPage.mockImplementation(() =>
    Promise.resolve({ setContent: mockSetContent, pdf: mockPdf }),
  );
  mockClose.mockResolvedValue(undefined);
  mockLaunch.mockImplementation(() =>
    Promise.resolve({ newPage: mockNewPage, close: mockClose }),
  );
}

describe('isPdfPoolReady', () => {
  afterEach(async () => resetPool());

  it('returns false before initialisation', () => {
    expect(isPdfPoolReady()).toBe(false);
  });

  it('returns true after successful initialisation', async () => {
    await initPdfPool(1);
    expect(isPdfPoolReady()).toBe(true);
  });

  it('returns false after shutdown', async () => {
    await initPdfPool(1);
    await shutdownPdfPool();
    expect(isPdfPoolReady()).toBe(false);
  });
});

describe('initPdfPool', () => {
  afterEach(async () => resetPool());

  it('launches one Chromium browser', async () => {
    await initPdfPool(2);
    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  it('pre-creates the requested number of pages', async () => {
    await initPdfPool(3);
    expect(mockNewPage).toHaveBeenCalledTimes(3);
  });

  it('passes sandbox-disabled args to chromium.launch', async () => {
    await initPdfPool(1);
    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['--no-sandbox']),
      }),
    );
  });
});

describe('convertToPdf', () => {
  afterEach(async () => resetPool());

  it('throws when the pool is not initialised', async () => {
    await expect(convertToPdf('<html/>')).rejects.toThrow(
      'PDF pool not initialised',
    );
  });

  it('returns a Buffer containing PDF bytes', async () => {
    await initPdfPool(1);
    const buf = await convertToPdf('<html><body>Hello</body></html>');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString('utf8', 0, 4)).toBe('%PDF');
  });

  it('calls page.setContent with the provided HTML', async () => {
    await initPdfPool(1);
    const html = '<html><body>Test</body></html>';
    await convertToPdf(html);
    expect(mockSetContent).toHaveBeenCalledWith(html, { waitUntil: 'load' });
  });

  it('calls page.pdf with A4 format and printBackground by default', async () => {
    await initPdfPool(1);
    await convertToPdf('<html/>');
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'A4',
        printBackground: true,
        landscape: false,
      }),
    );
  });

  it('honours paperSize override', async () => {
    await initPdfPool(1);
    await convertToPdf('<html/>', { paperSize: 'A5' });
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'A5' }),
    );
  });

  it('honours landscape orientation', async () => {
    await initPdfPool(1);
    await convertToPdf('<html/>', { orientation: 'landscape' });
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({ landscape: true }),
    );
  });

  it('handles concurrent requests by queuing when pool is exhausted', async () => {
    // pool size = 1, fire two requests simultaneously
    await initPdfPool(1);
    const [buf1, buf2] = await Promise.all([
      convertToPdf('<html><body>Request 1</body></html>'),
      convertToPdf('<html><body>Request 2</body></html>'),
    ]);
    expect(Buffer.isBuffer(buf1)).toBe(true);
    expect(Buffer.isBuffer(buf2)).toBe(true);
  });
});

describe('shutdownPdfPool', () => {
  it('closes the browser on shutdown', async () => {
    await initPdfPool(1);
    await shutdownPdfPool();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — calling shutdown twice does not throw', async () => {
    await initPdfPool(1);
    await shutdownPdfPool();
    await expect(shutdownPdfPool()).resolves.not.toThrow();
  });
});
