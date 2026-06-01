# Bahmni Template Service

A Node.js/TypeScript microservice that renders configurable clinical documents (prescriptions, registration cards, discharge summaries, etc.) as HTML. Templates live in `standard-config` — an implementer edits a template file, and the next print request picks up the change automatically. No service restart or frontend rebuild required.

---

## Table of Contents

1. [How it fits into Bahmni](#1-how-it-fits-into-bahmni)
2. [Repository layout](#2-repository-layout)
3. [Request lifecycle](#3-request-lifecycle)
4. [API reference](#4-api-reference)
5. [Authentication](#5-authentication)
6. [Environment variables](#6-environment-variables)
7. [Running locally](#7-running-locally)
8. [Running tests](#8-running-tests)
9. [Adding a new template](#9-adding-a-new-template)

> **Template authors** — see the [Template Authoring Guide](../standard-config/print-templates/TEMPLATE_AUTHORING_GUIDE.md) for a full reference to `compute.js`, Nunjucks filters, and worked examples.

---

## 1. How it fits into Bahmni

```
Browser (React / Bahmni UI)
  │
  │  POST /template-service/api/render
  ▼
nginx  ──── proxy_pass ────►  template-service:8080  (this service)
                                      │
                          reads templates from disk
                          /etc/bahmni_config/print-templates/
                          (Docker bind-mount from standard-config)
                                      │
                          resolver.ts fetches declared FHIR/REST sources
                          from OpenMRS (JSESSIONID forwarded from browser)
                          compute.js transforms pre-fetched data into fields
                                      │
                          returns rendered HTML string
                                      │
                      Browser handles print dialog
```

Templates are mounted from `standard-config` at runtime. The service uses **mtime-based caching** — edits to `templates.json` and `_i18n/*.json` are picked up on the next request without restarting.

---

## 2. Repository layout

```
bahmni-template-service/
├── src/
│   ├── server.ts               Express app — routes, auth, error mapping
│   ├── types.ts                All TypeScript interfaces (single source of truth)
│   ├── errors.ts               AppError hierarchy (ValidationError, NotFoundError, …)
│   ├── template/
│   │   ├── store.ts            Reads templates.json (mtime-cached)
│   │   ├── renderer.ts         Nunjucks environment, custom filters, async render()
│   │   └── fhirPath.ts         FHIRPath evaluation (used by | fhirpathEvaluate filter)
│   └── data/
│       ├── resolver.ts         Fetches FHIR/REST sources declared in data-config.json
│       └── scriptRunner.ts     Runs compute.js with pre-fetched resolved sources
├── .env.example                Copy to .env for local dev
├── Dockerfile
└── docs/USAGE_GUIDE.md
```

---

## 3. Request lifecycle

```
1. React sends:
   POST /template-service/api/render
   {
     "templateId": "REG_CARD_V1",
     "format": "html",
     "locale": "en",
     "context": { "patientUuid": "abc-123", "visitUuid": "xyz-456" }
   }

2. server.ts validates the request and loads the template via templateStore.

3. templateStore reads templates.json → finds REG_CARD_V1 → checks template.html exists.
   templates.json is mtime-cached; disk is only re-read when the file changes.

4. If data-config.json exists, resolver.ts fetches the declared REST/FHIR sources from
   OpenMRS using the forwarded session headers. Each call is bounded by OPENMRS_TIMEOUT_MS.

5. If compute.js exists, scriptRunner.ts runs it.
   compute.js receives { context, resolved, data, ValidationError, fhirPath, translate, locale }.
   It transforms the pre-fetched resolved sources into a plain object returned to the template.

6. renderer.ts renders template.html with Nunjucks, passing:
     { computed, data, locale, now, ...<sourceNames> }
   Custom filters (| t, | barcode, | qrcode, | dateFormat, | age, | round, …) run inline.
   render() is async because the | barcode filter uses bwip-js zlib streams.

7. server.ts sends the HTML response.
   The browser handles the print dialog.
```

---

## 4. API reference

### `GET /template-service/api/templates`

Returns all registered templates. The Bahmni UI calls this on load to decide which print buttons to show.

**Response**
```json
{
  "templates": [
    {
      "id": "REG_CARD_V1",
      "name": "Registration Card"
    }
  ]
}
```

---

### `POST /template-service/api/render`

Runs `compute.js` and renders the template.

**Request body**
```json
{
  "templateId": "REG_CARD_V1",
  "format": "html",
  "locale": "en",
  "context": {
    "patientUuid": "62d4400b-7bb9-4a0a-a2a5-620b080ee266"
  },
  "data": {
    "printedBy": "Dr. Smith"
  }
}
```

| Field | Required | Default | Description |
|---|---|---|---|
| `templateId` | Yes | — | Must match an `id` in `templates.json` |
| `format` | No | `"html"` | Only `"html"` is supported |
| `locale` | No | `"en"` | BCP 47 language tag (e.g. `"fr"`, `"hi"`) |
| `context` | No | `{}` | UUIDs forwarded to `data-config.json` placeholders and `compute.js` |
| `data` | No | `{}` | Free-form object available as `{{ data.* }}` in templates and `data` in `compute.js` |

**Responses**

| Status | Body | Cause |
|---|---|---|
| `200` | `{ "html": "..." }` | Success |
| `400` | `{ "message": "..." }` | Missing `templateId`, invalid `format`, or invalid `locale` |
| `404` | `{ "message": "Template not found: ..." }` | `templateId` not in `templates.json` |
| `401` | `{ "message": "OpenMRS session expired..." }` | Session cookie invalid or expired |
| `502` | `{ "message": "OpenMRS API unreachable..." }` | OpenMRS timeout or network error |
| `500` | `{ "message": "..." }` | Unexpected render error |

---

### `GET /template-service/health`

Docker health check. Returns `{ "status": "ok", "timestamp": "..." }`.

---

## 5. Authentication

The service forwards the browser's session to OpenMRS on every API call made by `data-config.json` sources. No credentials are stored in the service.

| Header | Description |
|---|---|
| `Cookie: JSESSIONID=...` | Standard browser session (production — forwarded by nginx) |
| `x-openmrs-session-id: ...` | Alternative session header |
| `x-openmrs-authorization: Basic ...` | Basic Auth header (dev/testing) |

In production, nginx forwards the browser's `JSESSIONID` cookie transparently. For local curl testing, pass `-H "Cookie: JSESSIONID=<value>"` copied from browser DevTools.

---

## 6. Environment variables

Copy `.env.example` to `.env` for local development.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port the service listens on |
| `OPENMRS_URL` | `http://openmrs:8080` | OpenMRS base URL (Docker service name in prod) |
| `TEMPLATES_DIR` | `/etc/bahmni_config/print-templates` | Absolute path to the templates directory |
| `OPENMRS_TIMEOUT_MS` | `10000` | Per-request timeout for OpenMRS calls made by `data-config.json` sources (ms) |
| `LOG_LEVEL` | `info` | Log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |

---

## 7. Running locally

```bash
# 1. Install dependencies
yarn install

# 2. Copy and edit env file
cp .env.example .env
# Set TEMPLATES_DIR to your standard-config checkout:
#   TEMPLATES_DIR=/path/to/standard-config/print-templates

# 3. Start in dev mode (auto-restarts on TypeScript changes)
yarn dev

# 4. Test a render (use a real JSESSIONID from browser DevTools)
curl -s -X POST http://localhost:8080/template-service/api/render \
  -H "Content-Type: application/json" \
  -H "Cookie: JSESSIONID=<your-session-id>" \
  -d '{"templateId":"REG_CARD_V1","locale":"en","context":{"patientUuid":"<uuid>"}}'
```

---

## 8. Running tests

```bash
yarn test                                             # run all tests
yarn jest --testPathPattern=renderer --verbose        # single suite
yarn tsc --noEmit                                     # type-check only
yarn build                                            # compile to dist/
```

| Suite | What it covers |
|---|---|
| `renderer.test.ts` | Barcode PNG signature, barcode fallback, i18n mtime cache, missing-translation fallback |
| `templateStore.test.ts` | Cache hit, mtime invalidation, missing files, template loading |
| `clinical.test.ts` | age, bmi, los, abnormalFlag helpers |

---

## 9. Adding a new template

All template files live in `standard-config`. No TypeScript changes needed.

**Step 1 — Create a folder** under `print-templates/`:
```
print-templates/
└── discharge-summary/
    ├── template.html     ← required
    └── compute.js        ← transforms pre-fetched resolved sources
```

**Step 2 — Register in `templates.json`:**
```json
{
  "id": "DISCHARGE_V1",
  "name": "Discharge Summary",
  "folder": "discharge-summary"
}
```

**Step 3 — Write `compute.js`** to transform pre-fetched resolved sources and return a plain object.

**Step 4 — Write `template.html`** using `{{ computed.* }}`, `{{ data.* }}`, and the built-in Nunjucks filters.

Template edits are live — no service restart needed.

