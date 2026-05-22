/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

export const DEFAULT_PORT = 8080;
export const BODY_SIZE_LIMIT = '10mb';
export const SHUTDOWN_TIMEOUT_MS = 10_000;

export const DEFAULT_OPENMRS_URL = 'http://openmrs:8080';
export const FHIR_API_PATH = '/openmrs/ws/fhir2/R4';
export const DEFAULT_OPENMRS_TIMEOUT_MS = 10_000;

export const DEFAULT_TEMPLATES_DIR = '/etc/bahmni_config/print-templates';
export const DEFAULT_LOCALE = 'en';

export const FILE_ENCODING = 'utf-8';

export const REGISTRY_FILE = 'templates.json';
export const TEMPLATE_HTML = 'template.html';
export const DATA_CONFIG_FILE = 'data-config.json';
export const COMPUTE_SCRIPT = 'compute.js';
export const STYLESHEET_FILE = 'styles.css';
export const I18N_DIR = '_i18n';

export const LOCALE_REGEX = /^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/;

export const JSESSIONID_PREFIX = 'JSESSIONID=';
export const AXIOS_TIMEOUT_CODE = 'ECONNABORTED';
export const HEADER_SESSION_ID = 'x-openmrs-session-id';
export const HEADER_AUTHORIZATION = 'x-openmrs-authorization';

export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
} as const;

export const RENDER_FORMAT = 'html';

export const API_BASE = '/template-service/api';
export const TEMPLATES_PATH = `${API_BASE}/templates`;
export const RENDER_PATH = `${API_BASE}/render`;
export const HEALTH_PATH = '/template-service/health';
