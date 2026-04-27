import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  openmrsUrl: process.env.OPENMRS_URL || 'http://openmrs:8080',
  maxConcurrentPdf: parseInt(process.env.MAX_CONCURRENT_PDF, 10) || 2,
  defaultLocale: process.env.DEFAULT_LOCALE || 'en',
  templatesDir: process.env.TEMPLATES_DIR || path.join(__dirname, '..', 'config', 'print-templates'),
  tlsRejectUnauthorized: process.env.TLS_REJECT_UNAUTHORIZED !== '0',
};

export default config;
