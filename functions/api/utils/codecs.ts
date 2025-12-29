/**
 * Shared codecs for storing user-visible fields in D1 as TEXT while serving arrays/objects to clients.
 *
 * - description_text: newline-delimited lines -> string[]
 * - tags_text: CSV-quoted list -> string[]
 */

export function encodeDescriptionText(input: unknown): string {
  if (Array.isArray(input)) {
    return input
      .map((v) => String(v ?? "").replace(/\r?\n/g, "\n"))
      .join("\n");
  }
  const s = String(input ?? "");
  // Normalize any CRLF to LF
  return s.replace(/\r?\n/g, "\n");
}

export function decodeDescriptionText(descriptionText: unknown): string[] {
  const s = String(descriptionText ?? "");
  if (!s) return [];
  return s
    .split(/\r?\n/)
    .map((v) => v.trimEnd())
    .filter((v) => v.length > 0);
}

export function encodeTagsText(tags: unknown): string {
  const list = Array.isArray(tags)
    ? tags
    : typeof tags === "string"
      ? splitLooseTags(tags)
      : [];
  return list
    .map((t) => String(t ?? ""))
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map(csvQuote)
    .join(",");
}

export function decodeTagsText(tagsText: unknown): string[] {
  const s = String(tagsText ?? "").trim();
  if (!s) return [];
  return parseCsvQuotedList(s);
}

function csvQuote(value: unknown): string {
  const s = String(value ?? "");
  // CSV rule: double quotes are escaped by doubling them.
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function splitLooseTags(input: string): string[] {
  // Used when admin sends a comma-separated string; not used for storage.
  return String(input ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function parseCsvQuotedList(input: string): string[] {
  const out = [];
  let i = 0;
  const s = String(input ?? "");

  while (i < s.length) {
    // Skip leading whitespace / commas
    while (i < s.length && (s[i] === " " || s[i] === "\t" || s[i] === ",")) i += 1;
    if (i >= s.length) break;

    if (s[i] !== '"') {
      // Fallback: unquoted token until comma
      let j = i;
      while (j < s.length && s[j] !== ",") j += 1;
      const raw = s.slice(i, j).trim();
      if (raw) out.push(raw);
      i = j + 1;
      continue;
    }

    // Quoted field
    i += 1; // consume opening quote
    let buf = "";
    while (i < s.length) {
      const ch = s[i];
      if (ch === '"') {
        const next = s[i + 1];
        if (next === '"') {
          buf += '"';
          i += 2;
          continue;
        }
        // closing quote
        i += 1;
        break;
      }
      buf += ch;
      i += 1;
    }
    if (buf) out.push(buf);

    // consume until comma or end
    while (i < s.length && s[i] !== ",") i += 1;
    if (s[i] === ",") i += 1;
  }

  return out;
}


