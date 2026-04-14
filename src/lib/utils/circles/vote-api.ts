import { NextResponse } from "next/server";

/** UUID v4-style string (PostgreSQL `uuid` text form). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_UUID_LEN = 36;

export function isValidUuidParam(id: string): boolean {
  return id.length === MAX_UUID_LEN && UUID_REGEX.test(id);
}

export type ParsedUuidArray =
  | { ok: true; ids: string[] }
  | { ok: false; message: string };

/**
 * Validates an array of UUID strings; caps length to maxCount.
 * Rejects non-strings, wrong length, or invalid pattern.
 */
export function parseUuidIdArray(raw: unknown, maxCount: number): ParsedUuidArray {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "Body must include an array of ids" };
  }
  if (raw.length > maxCount) {
    return { ok: false, message: `At most ${maxCount} ids allowed` };
  }
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, message: "Each id must be a string" };
    }
    if (item.length > MAX_UUID_LEN) {
      return { ok: false, message: "Invalid id format" };
    }
    if (!isValidUuidParam(item)) {
      return { ok: false, message: "Invalid id format" };
    }
    out.push(item);
  }
  return { ok: true, ids: out };
}

export function jsonNotFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function jsonInvalidId(): NextResponse {
  return NextResponse.json({ error: "Invalid id" }, { status: 400 });
}
