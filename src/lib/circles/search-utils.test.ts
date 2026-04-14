import test from "node:test";
import assert from "node:assert/strict";
import { clampInt, isUuid, normalizeQuery } from "./search-utils";

test("isUuid detects UUID v4-ish strings", () => {
  assert.equal(isUuid("310abf9c-148f-4e8c-9d00-5d265db43a49"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("310abf9c148f4e8c9d005d265db43a49"), false);
});

test("normalizeQuery trims and collapses whitespace", () => {
  assert.equal(normalizeQuery("  hello   world  "), "hello world");
  assert.equal(normalizeQuery(""), "");
  assert.equal(normalizeQuery(null), "");
});

test("clampInt parses and clamps", () => {
  assert.equal(clampInt("5", 1, 1, 10), 5);
  assert.equal(clampInt("0", 1, 1, 10), 1);
  assert.equal(clampInt("999", 1, 1, 10), 10);
  assert.equal(clampInt("nope", 7, 1, 10), 7);
  assert.equal(clampInt(null, 7, 1, 10), 7);
});

