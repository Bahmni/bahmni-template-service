/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

export interface TemplateEntry {
  id: string;
  name: string;
  folder: string;
}

export interface TemplateRegistry {
  templates: TemplateEntry[];
}

export interface DataSource {
  api: 'fhir' | 'rest' | 'image';
  resource: string;
  params?: Record<string, string | string[]>;
}

export interface DataConfig {
  sources?: Record<string, DataSource>;
}

export type ResolvedSources = Record<string, unknown>;

export interface LoadedTemplate {
  id: string;
  name: string;
  templatePath: string;
  dataConfigPath?: string;
  computeScriptPath?: string;
  stylesheetPath?: string;
}

export type RenderFormat = (typeof import('./constants').RENDER_FORMATS)[number];

export interface EmailAttachment {
  cid: string;
  content: string;
  encoding: 'base64';
  contentType: string;
}

export interface EmailResult {
  html: string;
  attachments: EmailAttachment[];
}

export interface RenderRequest {
  templateId: string;
  format?: RenderFormat;
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

export interface AuthHeaders {
  cookie?: string;
  sessionId?: string;
  authorization?: string;
}
