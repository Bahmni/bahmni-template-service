let browser = null;
let pagePool = [];
let waitQueue = [];

export async function init(maxConcurrent = 2) {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  for (let i = 0; i < maxConcurrent; i++) {
    const page = await browser.newPage();
    pagePool.push(page);
  }
}

function acquirePage() {
  if (pagePool.length > 0) {
    return Promise.resolve(pagePool.pop());
  }
  return new Promise((resolve) => waitQueue.push(resolve));
}

function releasePage(page) {
  if (waitQueue.length > 0) {
    waitQueue.shift()(page);
  } else {
    pagePool.push(page);
  }
}

export async function convert(html, pageSettings = {}) {
  if (!browser) {
    throw new Error('PDF pool not initialized. Call init() first.');
  }

  const page = await acquirePage();
  try {
    await page.setContent(html, { waitUntil: 'load' });
    const pdfBuffer = await page.pdf({
      format: pageSettings.paperSize || 'A4',
      landscape: pageSettings.orientation === 'landscape',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    });
    return pdfBuffer;
  } finally {
    releasePage(page);
  }
}

export function isReady() {
  return browser !== null;
}

export async function shutdown() {
  if (browser) {
    await browser.close();
    browser = null;
    pagePool = [];
    waitQueue = [];
  }
}
