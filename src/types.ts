export interface TemplateEntry {
  id: string;
  name: string;
  folder: string;
}

export interface TemplateRegistry {
  templates: TemplateEntry[];
}

// ---------------------------------------------------------------------------
// data-config.json types
// ---------------------------------------------------------------------------

export interface DataSource {
  api: 'fhir' | 'rest';
  resource: string;
  params?: Record<string, string | string[]>;
}

export interface DataConfig {
  sources?: Record<string, DataSource>;
}

export type ResolvedSources = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

export interface LoadedTemplate {
  id: string;
  name: string;
  templatePath: string;
  dataConfigPath?: string;
  computeScriptPath?: string;
  stylesheetPath?: string;
}

export interface RenderRequest {
  templateId: string;
  format?: 'html';
  locale?: string;
  context?: Record<string, string>;
  data?: Record<string, unknown>;
}

export interface TemplateListResponse {
  templates: Array<{
    id: string;
    name: string;
  }>;
}

export interface RenderResponse {
  html: string;
}

export interface ErrorResponse {
  message: string;
  detail?: string;
}
