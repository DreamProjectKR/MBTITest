# Appendix: Data Schemas

## 1. Test Index Schema (`assets/index.json`)

### Purpose

Lists available tests and points to each test definition JSON.

### Observed Example Fields

- `tests`: array
  - `id`: string (unique)
  - `title`: string
  - `thumbnail`: string (path or URL)
  - `tags`: string[]
  - `path`: string (usually `test-xxx/test.json`, backend will normalize to `assets/<path>`)
  - `createdAt`: string (date-ish)
  - `updatedAt`: string (date-ish)

### Minimal Contract (Required)

- `tests` must exist and be an array (or backend will treat as empty).
- Each entry should have:
  - `id`
  - `path`
  - (recommended) `title`, `thumbnail`, `tags`, timestamps

### JSON Schema (informal)

```json
{
  "type": "object",
  "properties": {
    "tests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "thumbnail": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } },
          "path": { "type": "string" },
          "createdAt": { "type": "string" },
          "updatedAt": { "type": "string" }
        },
        "required": ["id", "path"]
      }
    }
  },
  "required": ["tests"]
}
```

## 2. Test Definition Schema (`assets/<test-id>/test.json`)

### Purpose

Defines a test, including questions and results.

### Observed Example Fields

- `id`: string
- `title`: string
- `description`: string or string[]
- `author`: string
- `authorImg`: string (path)
- `tags`: string[]
- `thumbnail`: string (path)
- `questions`: array
  - `id`: string
  - `prompt`: string (path to image)
  - `answers`: array (typically 2)
    - `id`: string
    - `label`: string
    - `mbtiAxis`: one of `EI`, `SN`, `TF`, `JP`
    - `direction`: letter belonging to that axis
- `results`: object map keyed by MBTI (16 keys)
  - each value currently contains:
    - `image`: string (path)
    - (optional) `summary`: string (README mentions it, current sample omits)

### Minimal Contract (Required)

- `id`, `title`, `questions`, `results`.
- For every answer:
  - `mbtiAxis` and `direction` must be present, otherwise that answer will not affect scoring.
- `results` should contain keys for all 16 MBTI values to avoid missing-result behavior.

### Notes

- Quiz code uses `prompt` as an image path and assigns it to `<img src>`.
- Result code expects `results[MBTI].image`.
- `description` is supported as either string or array; the intro page will render an array as multiple lines.
- `results[MBTI]` may contain additional fields (e.g., `summary`) without breaking current pages; current sample includes only `image`.

## 3. MBTI Scoring Rules

- Axes:
  - EI: E vs I
  - SN: S vs N
  - TF: T vs F
  - JP: J vs P
- Computation:
  - Count selections per direction within each axis.
  - Tie-breaker chooses the first letter (E, S, T, J).
