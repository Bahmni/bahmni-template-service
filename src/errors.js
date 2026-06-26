export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(templateId) {
    super(`Template not found: ${templateId}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateDisabledError extends Error {
  constructor(templateId) {
    super(`Template is disabled: ${templateId}`);
    this.name = 'TemplateDisabledError';
  }
}

export class DataFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataFetchError';
  }
}

export class PdfEngineDisabledError extends Error {
  constructor() {
    super('PDF generation is disabled. Set ENABLE_PDF_ENGINE=true to enable it.');
    this.name = 'PdfEngineDisabledError';
  }
}
