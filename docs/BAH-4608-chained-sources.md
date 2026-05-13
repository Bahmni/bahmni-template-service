# Chained API Sources in data-config.json

## Problem

All sources in `data-config.json` are fetched in parallel. There is no way to use the result of API A as a parameter for API B. Making API calls inside `compute.js` is not an option — it has no access to forwarded auth headers or the HTTP client.

---

## Solution: Two new optional fields on any source

| Field | Purpose |
|---|---|
| `dependsOn` | Wait for one or more sources to complete before fetching this one |
| `condition` | Skip this fetch entirely if a value in a resolved source fails the check |

Sources without these fields behave exactly as today (all fetched in parallel).

---

## Q1 — Can a dependent source use both resolved-source data AND request context data in the same params?

**Yes.** The substitution function inspects the first segment of every `{{...}}` token:
- First segment matches a resolved source name → reads from that source's response via dot-path
- Otherwise → reads from request `context` (unchanged behaviour)

```json
"encounters": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/encounter",
  "dependsOn": "patient",
  "params": {
    "patient":  "{{patient.entry.0.resource.id}}",
    "fromdate": "{{fromDate}}",
    "v":        "custom:(uuid,display)"
  }
}
```

- `{{patient.entry.0.resource.id}}` → from resolved `patient` source, any depth works
- `{{fromDate}}` → from request `context`
- `v` → literal string, no substitution

The resource path itself also supports this:
```json
"visitDetail": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/visit/{{visits.results.0.uuid}}",
  "dependsOn": "visits"
}
```

---

## Q2 — How to conditionally skip API B based on API A's result?

Add a `condition` object with a required `path` and an optional comparison operator.

### Truthy check (no operator) — skip if path resolves to null / empty / 0 / false

```json
"encounters": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/encounter",
  "dependsOn": "patient",
  "condition": { "path": "patient.entry.length" },
  "params": {
    "patient": "{{patient.entry.0.resource.id}}"
  }
}
```

`patient.entry.length === 0` → falsy → `encounters` is skipped. `resolved.encounters` is `null` in `compute.js`.

### Equality check — hardcoded value

```json
"maternalVisits": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/visit",
  "dependsOn": "patient",
  "condition": { "path": "patient.entry.0.resource.gender", "eq": "female" },
  "params": { "patient": "{{patient.entry.0.resource.id}}" }
}
```

### Equality check — value from request context

`eq` and `ne` follow the same substitution rules as `params`. `{{contextVar}}` is resolved from the request context:

```json
"condition": { "path": "patient.entry.0.resource.gender", "eq": "{{gender}}" }
```

Caller passes `context: { patientUuid: "...", gender: "female" }`. If `{{gender}}` is missing from context, the resolver throws: `Missing context variable "{{gender}}" in condition`.

### Equality check — value from another resolved source

`eq` and `ne` also support `{{sourceName.path.to.value}}` — the same dot-path syntax used in `params`. The referenced source must be in `dependsOn`.

```json
"maternalFollowUp": {
  "api": "rest",
  "resource": "/openmrs/ws/rest/v1/visit",
  "dependsOn": ["patient", "profile"],
  "condition": {
    "path":  "patient.entry.0.resource.gender",
    "eq":    "{{profile.person.gender}}"
  },
  "params": { "patient": "{{patient.entry.0.resource.id}}" }
}
```

This is technically no different from `params` substitution — `resolved` and `getNestedValue` are already available inside `evaluateCondition`. There is no reason to restrict it.

### Not-equal check

```json
"condition": { "path": "patient.entry.0.resource.deceasedBoolean", "ne": true }
```

### Supported operators

| Operator | Meaning | Supports substitution in value? |
|---|---|---|
| *(none)* | truthy — non-null, non-empty-string, non-zero, non-false, non-empty-array | n/a |
| `eq` | strict equal (`===`) | yes — `{{contextVar}}` and `{{sourceName.path}}` |
| `ne` | strict not-equal (`!==`) | yes — `{{contextVar}}` and `{{sourceName.path}}` |

### Cascade skip (automatic)

If a `dependsOn` source is `null` (it was skipped by its own condition), the current source is **automatically skipped** without needing its own condition. This prevents param-substitution errors from cascading through a chain. `compute.js` gets `null` for the skipped source.

---

## Q3 — Filtering a list: collect IDs from entries that match a given value

`{{sourceName.path}}` only resolves a scalar at a fixed index. When you need to **filter an array, extract a field from each matching item, and join them into a param**, use an `$extract` object as the param value.

### Scenario

API A returns a FHIR bundle. You want entries whose `resource.encounter.reference` contains the given `visitUuid`, then use their `resource.id` values as a comma-joined param for API B.

```json
"visitObs": {
  "api": "fhir",
  "resource": "Observation",
  "dependsOn": "allObs",
  "params": {
    "_id": {
      "$extract": {
        "from":  "allObs.entry",
        "where": { "path": "resource.encounter.reference", "contains": "{{visitUuid}}" },
        "pick":  "resource.id",
        "join":  ","
      }
    }
  }
}
```

- `from` — dot-path to the array inside a resolved source (`sourceName.path.to.array`)
- `where` — filter applied to each item; same operators as `condition`: `contains`, `eq`, `ne`. All support `{{contextVar}}` and `{{sourceName.path}}` substitution.
- `pick` — dot-path within each matched item to extract
- `join` — separator string (default `,`)

**If the filter produces no matches, the source is auto-skipped** — same behaviour as a failed `condition`. This avoids sending `?_id=` with an empty value to the API.

### `where` operators for `$extract`

| Operator | Meaning |
|---|---|
| `contains` | item's value at `path` is a string that includes the given substring |
| `eq` | strict equal |
| `ne` | strict not-equal |
| *(none)* | truthy — item has a non-null, non-empty value at `path` |

All operator values support `{{contextVar}}` and `{{sourceName.path}}` substitution.

### Mixing `$extract` and scalar params

Plain string params and `$extract` params can appear in the same `params` block. Each is resolved independently — they have no effect on each other.

```json
"params": {
  "encounter": {
    "$extract": {
      "from":  "allObs.entry",
      "where": { "path": "resource.encounter.reference", "contains": "{{visitUuid}}" },
      "pick":  "resource.id",
      "join":  ","
    }
  },
  "category": "{{obsCategory}}"
}
```

`encounter` → filters `allObs.entry` by visit reference, joins matching IDs.  
`category` → resolved from request context as a plain string.

You can also have two `$extract` params — each runs its own independent filter:

```json
"params": {
  "encounter": {
    "$extract": {
      "from":  "allObs.entry",
      "where": { "path": "resource.encounter.reference", "contains": "{{visitUuid}}" },
      "pick":  "resource.id",
      "join":  ","
    }
  },
  "code": {
    "$extract": {
      "from":  "allObs.entry",
      "where": { "path": "resource.code.coding.0.code", "eq": "{{conceptCode}}" },
      "pick":  "resource.id",
      "join":  ","
    }
  }
}
```

`buildUrl` loops over every key in `params` and resolves each value independently — string values go through `substituteValue`, `$extract` objects go through `resolveExtractParam`.

---

## Full example

```json
{
  "sources": {
    "patient": {
      "api": "fhir",
      "resource": "Patient",
      "params": { "_id": "{{patientUuid}}" }
    },
    "allObs": {
      "api": "fhir",
      "resource": "Observation",
      "dependsOn": "patient",
      "condition": { "path": "patient.entry.length" },
      "params": { "subject": "{{patient.entry.0.resource.id}}" }
    },
    "visitObs": {
      "api": "fhir",
      "resource": "Observation",
      "dependsOn": "allObs",
      "params": {
        "_id": {
          "$extract": {
            "from":  "allObs.entry",
            "where": { "path": "resource.encounter.reference", "contains": "{{visitUuid}}" },
            "pick":  "resource.id",
            "join":  ","
          }
        }
      }
    }
  }
}
```

Execution order:
1. `patient` — no deps, fetched first
2. `allObs` — waits for `patient`; skipped if patient has no entries
3. `visitObs` — waits for `allObs`; auto-skipped if `allObs` was skipped; skipped if filter matches nothing

---

## Code Changes

### `src/types.ts`

```diff
+export interface SourceCondition {
+  path: string;                        // "sourceName.nested.path"
+  eq?: string | number | boolean;
+  ne?: string | number | boolean;
+}
+
+export interface ExtractParam {
+  $extract: {
+    from:    string;                   // "sourceName.path.to.array"
+    where?: {
+      path:       string;              // dot-path within each array item
+      contains?:  string;              // substring match; supports {{}} substitution
+      eq?:        string | number | boolean;
+      ne?:        string | number | boolean;
+    };
+    pick:    string;                   // dot-path within each matched item to extract
+    join?:   string;                   // separator (default ",")
+  };
+}

export interface DataSource {
  api: 'fhir' | 'rest';
  resource: string;
- params?: Record<string, string>;
+ params?: Record<string, string | ExtractParam>;
+ dependsOn?: string | string[];
+ condition?: SourceCondition;
}
```

### `src/data/resolver.ts`

**1. `getNestedValue`** — dot-path traversal (array indices work as numbers)

```typescript
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== 'object') return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}
```

**2. `evaluateCondition`** — also receives `context` to substitute `{{contextVar}}` in `eq`/`ne`

```typescript
function evaluateCondition(
  condition: SourceCondition,
  resolved: ResolvedSources,
  context: Record<string, string>,
): boolean {
  const dotIndex   = condition.path.indexOf('.');
  const sourceName = dotIndex === -1 ? condition.path : condition.path.slice(0, dotIndex);
  const subPath    = dotIndex === -1 ? ''              : condition.path.slice(dotIndex + 1);
  const val        = subPath ? getNestedValue(resolved[sourceName], subPath) : resolved[sourceName];

  // Substitute {{contextVar}} or {{sourceName.path}} in string eq/ne values;
  // numbers and booleans are used as-is. Same rules as params substitution.
  const resolveCompare = (v: string | number | boolean): string | number | boolean => {
    if (typeof v !== 'string') return v;
    return v.replace(/\{\{([\w.]+)\}\}/g, (_, expr: string) => {
      const dotIndex = expr.indexOf('.');
      if (dotIndex !== -1) {
        const sourceName = expr.slice(0, dotIndex);
        if (sourceName in resolved) {
          const nested = getNestedValue(resolved[sourceName], expr.slice(dotIndex + 1));
          if (nested == null) throw new Error(`Cannot resolve "{{${expr}}}" in condition`);
          return String(nested);
        }
      }
      if (!(expr in context)) throw new Error(`Missing context variable "{{${expr}}}" in condition`);
      return context[expr];
    });
  };

  if (condition.eq !== undefined) return val === resolveCompare(condition.eq);
  if (condition.ne !== undefined) return val !== resolveCompare(condition.ne);

  if (val == null || val === '' || val === false || val === 0) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  return true;
}
```

**3. `substituteValue`** — replaces `substitute`; handles both resolved-source paths and context vars

```typescript
function substituteValue(
  template: string,
  context: Record<string, string>,
  resolved: ResolvedSources,
  label: string,
): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, expr: string) => {
    const dotIndex = expr.indexOf('.');
    if (dotIndex !== -1) {
      const sourceName = expr.slice(0, dotIndex);
      if (sourceName in resolved) {
        const val = getNestedValue(resolved[sourceName], expr.slice(dotIndex + 1));
        if (val == null)
          throw new Error(`Cannot resolve "{{${expr}}}" — path not found in source "${sourceName}"`);
        return String(val);
      }
    }
    const val = context[expr];
    if (val == null)
      throw new Error(`Missing context variable "{{${expr}}}" required by ${label}`);
    return val;
  });
}
```

**4. `resolveExtractParam`** — handles `$extract` param values: navigate to array, filter items, pick field, join

```typescript
function resolveExtractParam(
  extract: ExtractParam['$extract'],
  resolved: ResolvedSources,
  context: Record<string, string>,
): string {
  const dotIndex = extract.from.indexOf('.');
  if (dotIndex === -1)
    throw new Error(`$extract "from" must be "sourceName.arrayPath", got "${extract.from}"`);

  const sourceName = extract.from.slice(0, dotIndex);
  const arrayPath  = extract.from.slice(dotIndex + 1);
  const arr        = getNestedValue(resolved[sourceName], arrayPath);

  if (!Array.isArray(arr))
    throw new Error(`$extract "from" "${extract.from}" did not resolve to an array`);

  let items = arr as unknown[];

  if (extract.where) {
    const { path, contains, eq, ne } = extract.where;
    items = items.filter(item => {
      const val = getNestedValue(item, path);
      if (contains !== undefined) {
        const needle = substituteContextAndResolved(contains, context, resolved);
        return typeof val === 'string' && val.includes(needle);
      }
      if (eq !== undefined) return val === substituteContextAndResolved(String(eq), context, resolved);
      if (ne !== undefined) return val !== substituteContextAndResolved(String(ne), context, resolved);
      return val != null && val !== '' && val !== false && val !== 0;
    });
  }

  const picked = items
    .map(item => getNestedValue(item, extract.pick))
    .filter(v => v != null)
    .map(String);

  return picked.join(extract.join ?? ',');
}
```

`substituteContextAndResolved` is `substituteValue` renamed — same function, reused here.

**4b. `buildUrl`** — add `resolved` parameter; handle both `string` and `ExtractParam` param values; auto-skip source if `$extract` produces empty result

```typescript
function buildUrl(
  source: DataSource,
  context: Record<string, string>,
  resolved: ResolvedSources,
): { url: string; skip: boolean } {
  const resource = substituteValue(source.resource, context, resolved, 'resource path');
  const base = source.api === 'fhir'
    ? `${FHIR_BASE}/${resource}`
    : `${OPENMRS_URL}${resource}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(source.params ?? {})) {
    if (typeof value === 'string') {
      params.append(key, substituteValue(value, context, resolved, `param "${key}"`));
    } else {
      const extracted = resolveExtractParam(value.$extract, resolved, context);
      if (!extracted) return { url: base, skip: true }; // filter matched nothing — skip source
      params.append(key, extracted);
    }
  }

  const paramStr = params.toString();
  return { url: `${base}${paramStr ? `?${paramStr}` : ''}`, skip: false };
}
```

In `fetchSingleSource`, check `buildUrl`'s `skip` flag before making the HTTP request.

**5. Upfront validation** — `validateSources`, called once before the loop; catches typos and bad condition paths early

```typescript
function validateSources(sources: Record<string, DataSource>): void {
  const names = new Set(Object.keys(sources));
  for (const [name, source] of Object.entries(sources)) {
    for (const dep of normalizeDeps(source.dependsOn)) {
      if (!names.has(dep))
        throw new Error(`Source "${name}" dependsOn "${dep}" which is not defined in sources`);
    }
    if (source.condition) {
      const condSource = source.condition.path.split('.')[0];
      const deps = normalizeDeps(source.dependsOn);
      if (!deps.includes(condSource))
        throw new Error(
          `Source "${name}" condition path references "${condSource}" which is not in its dependsOn`,
        );
    }
  }
}
```

**6. `fetchSources`** — topological executor with cascade-skip

```typescript
function normalizeDeps(dep: string | string[] | undefined): string[] {
  if (!dep) return [];
  return Array.isArray(dep) ? dep : [dep];
}

async function fetchSources(
  sources: Record<string, DataSource>,
  context: Record<string, string>,
  auth: AuthHeaders,
): Promise<ResolvedSources> {
  validateSources(sources);

  const headers   = buildHeaders(auth);
  const resolved: ResolvedSources = {};
  const remaining = new Set(Object.keys(sources));

  while (remaining.size > 0) {
    const ready = [...remaining].filter(name =>
      normalizeDeps(sources[name].dependsOn).every(dep => dep in resolved),
    );

    if (ready.length === 0) {
      throw new Error(
        `Circular dependency detected among sources: ${[...remaining].join(', ')}`,
      );
    }

    const results = await Promise.all(
      ready.map(async (name) => {
        const source = sources[name];
        const deps   = normalizeDeps(source.dependsOn);

        // cascade skip — any dep was itself skipped
        if (deps.some(dep => resolved[dep] === null)) {
          logger.info({ sourceName: name }, 'DataResolver: source skipped (dependency was skipped)');
          return [name, null] as [string, null];
        }

        // condition check
        if (source.condition && !evaluateCondition(source.condition, resolved, context)) {
          logger.info({ sourceName: name }, 'DataResolver: source skipped (condition false)');
          return [name, null] as [string, null];
        }

        return fetchSingleSource(name, source, context, resolved, headers);
      }),
    );

    for (const [name, data] of results) {
      resolved[name] = data;
      remaining.delete(name);
    }
  }

  return resolved;
}
```

`fetchSingleSource` = existing per-source axios call + error handling extracted into its own function.

---

## Backward Compatibility

- Sources without `dependsOn` / `condition` → all placed in `ready` on the first iteration → same parallel `Promise.all()` as today.
- Params without dots (`{{patientUuid}}`) → `context` fallback, no behaviour change.
- Existing templates and configs require no changes.

---

## Error Reference

| Case | Error / Behaviour |
|---|---|
| `dependsOn` names a source that doesn't exist | Thrown at config validation: `dependsOn "X" is not defined in sources` |
| `condition.path` source not in `dependsOn` | Thrown at config validation: `condition path references "X" which is not in its dependsOn` |
| Circular dependency | Thrown in loop: `Circular dependency detected among sources: …` |
| Dot-path not found in resolved source | Thrown in `substituteValue`: `Cannot resolve "{{…}}" — path not found in source "…"` |
| Missing context variable | Thrown in `substituteValue`: `Missing context variable "{{…}}"` |
| Dependency was skipped | Current source auto-skipped; `null` stored in resolved |
| `condition` fails | Current source skipped; `null` stored in resolved |
| `$extract` filter matches nothing | Source auto-skipped; `null` stored in resolved |
| `$extract.from` path is not an array | Thrown in `resolveExtractParam`: `"from" did not resolve to an array` |
