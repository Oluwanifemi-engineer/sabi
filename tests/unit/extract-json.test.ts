import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractJson } from "../../src/lib/llm.ts";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  });

  it("parses JSON inside markdown fences", () => {
    const raw = 'Sure! Here is the analysis:\n```json\n{"a":[1,2]}\n```\nLet me know if you need anything else.';
    assert.deepEqual(extractJson(raw), { a: [1, 2] });
  });

  it("parses JSON with prose before and after (no fences)", () => {
    assert.deepEqual(extractJson("The result is {\"a\":1} as requested."), { a: 1 });
  });

  it("recovers trailing garbage after the JSON body", () => {
    assert.deepEqual(extractJson('{"a":1,"note":"x"} trailing text'), { a: 1, note: "x" });
  });

  it("throws when no JSON object or array is present", () => {
    assert.throws(() => extractJson("no structured output here"), /No JSON found/);
  });

  it("throws on truncated JSON with no closing brace", () => {
    assert.throws(() => extractJson('{"a":'), /Model output was not valid JSON/);
  });
});
