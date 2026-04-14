import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceMarkdownLength,
  hasRenderableMarkdownContent,
  normalizeMarkdownInput,
  sanitizeMarkdownUrl,
} from "./markdown";

test("normalizeMarkdownInput trims and normalizes line endings", () => {
  assert.equal(normalizeMarkdownInput("  hello\r\nworld  "), "hello\nworld");
  assert.equal(normalizeMarkdownInput(null), "");
});

test("hasRenderableMarkdownContent rejects markdown-only symbols", () => {
  assert.equal(hasRenderableMarkdownContent("### **__"), false);
  assert.equal(hasRenderableMarkdownContent("> useful content"), true);
  assert.equal(hasRenderableMarkdownContent("![diagram](https://example.com/diagram.png)"), true);
});

test("sanitizeMarkdownUrl blocks javascript and data protocols", () => {
  assert.equal(sanitizeMarkdownUrl("javascript:alert(1)"), "");
  assert.equal(sanitizeMarkdownUrl("data:text/plain,hi"), "");
  assert.equal(sanitizeMarkdownUrl("https://example.com"), "https://example.com");
});

test("enforceMarkdownLength validates upper bound", () => {
  assert.equal(enforceMarkdownLength("ok", 10), null);
  assert.equal(enforceMarkdownLength("a".repeat(11), 10), "Markdown content exceeds 10 characters");
});
