import test from "node:test";
import assert from "node:assert/strict";

import {
  encodeDescriptionText,
  decodeDescriptionText,
  encodeTagsText,
  decodeTagsText,
} from "../functions/api/utils/codecs.ts";

test("description_text: encode/decode roundtrip", () => {
  const lines = ["첫 줄", "둘째 줄", "셋째 줄"];
  const encoded = encodeDescriptionText(lines);
  assert.equal(encoded, "첫 줄\n둘째 줄\n셋째 줄");

  const decoded = decodeDescriptionText(encoded);
  assert.deepEqual(decoded, lines);
});

test("description_text: decode trims empty lines", () => {
  const decoded = decodeDescriptionText("\nA\n\nB\n");
  assert.deepEqual(decoded, ["A", "B"]);
});

test("tags_text: CSV quoting supports commas and quotes", () => {
  const tags = ['simple', 'hello,world', 'he said "wow"'];
  const encoded = encodeTagsText(tags);
  assert.equal(encoded, '"simple","hello,world","he said ""wow"""');

  const decoded = decodeTagsText(encoded);
  assert.deepEqual(decoded, tags);
});


