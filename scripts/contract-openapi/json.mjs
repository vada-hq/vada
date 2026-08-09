/**
 * 계약 문서를 다루는 순수 도우미.
 *
 * 여기 있는 것은 전부 **어느 계약 묶음인지 모른다.** 알 필요도 없다 —
 * 그래서 묶음이 늘어도 이 파일은 그대로다.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function clone(value) {
  return structuredClone(value);
}

export function sorted(values) {
  return [...values].sort();
}

export function equalSets(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function equalJson(left, right) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePath(path) {
  return path.split(sep).join("/");
}

export function unique(values) {
  return [...new Set(values)];
}

export async function readJson(root, path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

export async function readJsonIfPresent(root, path) {
  try {
    return await readJson(root, path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
