let browser = null;
let activeCount = 0;
let maxConcurrent = 2;
let waitQueue = [];

export async function init(concurrency = 2) {
  const { chromium } = await import('playwright');
  maxConcurrent = concurrency;
  browser = await chromium.launch({
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });
}

function acquireSlot() {
  if (activeCount < maxConcurrent) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releaseSlot() {
  if (waitQueue.length > 0) {
    waitQueue.shift()();
  } else {
    activeCount--;
  }
}

export async function convert(html, pageSettings = {}) {
  if (!browser) {
    throw new Error('PDF pool not initialized. Call init() first.');
  }

  await acquireSlot();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: pageSettings.paperSize || 'A4',
      landscape: pageSettings.orientation === 'landscape',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return pdfBuffer;
  } finally {
    await context.close();
    releaseSlot();
  }
}

export function isReady() {
  return browser !== null;
}

export async function shutdown() {
  if (browser) {
    await browser.close();
    browser = null;
    activeCount = 0;
    waitQueue = [];
  }
}
