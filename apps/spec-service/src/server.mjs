import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 3846;
export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
export const DEFAULT_MAX_FIGMA_RAW_BODY_BYTES = 25 * 1024 * 1024;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
// 자산은 벡터(SVG)와 래스터(PNG) 둘 다 있다. 마스코트처럼 이미지 fill을 가진
// 노드는 벡터로 뽑을 수 없다.
const ASSET_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(svg|png)$/;
const ASSET_CONTENT_TYPE = { svg: "image/svg+xml", png: "image/png" };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_SPECS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../specs/figma"
);

class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const ALLOWED_WEB_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+\.)?figma\.com$/i;

function resolveRequestOrigin(request) {
  const origin = request.headers.origin;

  // Origin 헤더가 없는 요청은 브라우저 밖 로컬 도구(CLI, 테스트)다.
  if (origin === undefined) {
    return { allowed: true, origin: null };
  }

  const value = String(origin).trim();

  // Figma 플러그인 iframe은 opaque origin이라 "null"을 보낸다.
  if (value === "null" || ALLOWED_WEB_ORIGIN_PATTERN.test(value)) {
    return { allowed: true, origin: value };
  }

  return { allowed: false, origin: null };
}

function setCorsHeaders(response, allowedOrigin) {
  response.setHeader("Vary", "Origin");
  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, If-Match, If-None-Match"
  );
  response.setHeader("Access-Control-Expose-Headers", "ETag");
  response.setHeader("Access-Control-Max-Age", "600");
}

function sendJson(response, statusCode, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function sendError(response, error) {
  if (error instanceof HttpError) {
    sendJson(response, error.statusCode, {
      error: { code: error.code, message: error.message }
    });
    return;
  }

  console.error("[spec-service] 요청 처리 실패", error);
  sendJson(response, 500, {
    error: {
      code: "internal_error",
      message: "화면 JSON을 처리하지 못했습니다."
    }
  });
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 또는 screenId 형식이 올바르지 않습니다."
    );
  }
}

function parseScreenRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "screens"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3]),
    screenId: decodePathSegment(segments[4])
  };
}

function parseFigmaRawRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 6 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "screens" ||
    segments[5] !== "figma-raw"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3]),
    screenId: decodePathSegment(segments[4])
  };
}

function parseScreenAssetRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 7 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "screens" ||
    segments[5] !== "assets"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3]),
    screenId: decodePathSegment(segments[4]),
    fileName: decodePathSegment(segments[6])
  };
}

function parseScreenReferenceRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 6 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "screens" ||
    segments[5] !== "reference"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3]),
    screenId: decodePathSegment(segments[4])
  };
}

function parseOptionSourcesRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 4 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "option-sources"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3])
  };
}

function parseStateScopesRoute(requestUrl) {
  const { pathname } = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const segments = pathname.split("/");

  if (
    segments.length !== 4 ||
    segments[0] !== "" ||
    segments[1] !== "v1" ||
    segments[2] !== "state-scopes"
  ) {
    return null;
  }

  return {
    wireframeKey: decodePathSegment(segments[3])
  };
}

function assertIdentifier(value) {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 또는 screenId 형식이 올바르지 않습니다."
    );
  }
}

export function resolveScreenSpecPath({ specsRoot, wireframeKey, screenId }) {
  assertIdentifier(wireframeKey);
  assertIdentifier(screenId);

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(
    absoluteRoot,
    wireframeKey,
    "screens",
    screenId,
    "screen.json"
  );
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 또는 screenId 형식이 올바르지 않습니다."
    );
  }

  return filePath;
}

export function resolveFigmaRawPath({ specsRoot, wireframeKey, screenId }) {
  assertIdentifier(wireframeKey);
  assertIdentifier(screenId);

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(
    absoluteRoot,
    wireframeKey,
    "screens",
    screenId,
    "figma.raw.json"
  );
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 또는 screenId 형식이 올바르지 않습니다."
    );
  }

  return filePath;
}

export function resolveScreenAssetPath({
  specsRoot,
  wireframeKey,
  screenId,
  fileName
}) {
  assertIdentifier(wireframeKey);
  assertIdentifier(screenId);

  if (!ASSET_FILE_PATTERN.test(fileName)) {
    throw new HttpError(
      400,
      "invalid_asset_name",
      "자산 파일 이름은 영숫자로 시작하고 .svg 또는 .png로 끝나야 합니다."
    );
  }

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(
    absoluteRoot,
    wireframeKey,
    "screens",
    screenId,
    "assets",
    fileName
  );
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_asset_name",
      "자산 파일 이름은 영숫자로 시작하고 .svg 또는 .png로 끝나야 합니다."
    );
  }

  return filePath;
}

export function resolveScreenReferencePath({ specsRoot, wireframeKey, screenId }) {
  assertIdentifier(wireframeKey);
  assertIdentifier(screenId);

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(
    absoluteRoot,
    wireframeKey,
    "screens",
    screenId,
    "reference.png"
  );
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 또는 screenId 형식이 올바르지 않습니다."
    );
  }

  return filePath;
}

export function resolveOptionSourcesPath({ specsRoot, wireframeKey }) {
  assertIdentifier(wireframeKey);

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(
    absoluteRoot,
    wireframeKey,
    "option-sources.json"
  );
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 형식이 올바르지 않습니다."
    );
  }

  return filePath;
}

export function resolveStateScopesPath({ specsRoot, wireframeKey }) {
  assertIdentifier(wireframeKey);

  const absoluteRoot = resolve(specsRoot);
  const filePath = resolve(absoluteRoot, wireframeKey, "state-scopes.json");
  const rootPrefix = absoluteRoot.endsWith(sep)
    ? absoluteRoot
    : `${absoluteRoot}${sep}`;

  if (!filePath.startsWith(rootPrefix)) {
    throw new HttpError(
      400,
      "invalid_identifier",
      "wireframeKey 형식이 올바르지 않습니다."
    );
  }

  return filePath;
}

function readRequestBody(
  request,
  maxBodyBytes,
  tooLargeMessage = "화면 JSON은 1MB를 넘을 수 없습니다.",
  { binary = false } = {}
) {
  const contentLength = Number(request.headers["content-length"] ?? 0);

  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    request.resume();
    throw new HttpError(
      413,
      "payload_too_large",
      tooLargeMessage
    );
  }

  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) {
        chunks.push(chunk);
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        rejectBody(
          new HttpError(
            413,
            "payload_too_large",
            tooLargeMessage
          )
        );
        return;
      }
      const body = Buffer.concat(chunks);
      resolveBody(binary ? body : body.toString("utf8"));
    });
    request.on("aborted", () => {
      rejectBody(
        new HttpError(
          400,
          "request_aborted",
          "요청 본문 전송이 중단되었습니다."
        )
      );
    });
    request.on("error", rejectBody);
  });
}

function parseScreenSpecJson(text, screenId) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "요청 본문이 올바른 JSON이 아닙니다."
    );
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_screen_spec",
      "화면 JSON은 객체여야 합니다."
    );
  }

  if (value.screenId !== screenId) {
    throw new HttpError(
      400,
      "screen_id_mismatch",
      "URL의 screenId와 화면 JSON의 screenId가 일치해야 합니다."
    );
  }

  return value;
}

function parseFigmaRawJson(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "요청 본문이 올바른 JSON이 아닙니다."
    );
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_figma_raw",
      "Figma 원본 JSON은 객체여야 합니다."
    );
  }

  if (
    !value.document ||
    typeof value.document !== "object" ||
    Array.isArray(value.document)
  ) {
    throw new HttpError(
      400,
      "invalid_figma_raw",
      "Figma 원본 JSON에 document 객체가 필요합니다."
    );
  }

  return value;
}

function createRevision(text) {
  return `"${createHash("sha256").update(text).digest("hex")}"`;
}

async function readStoredText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readJsonField(filePath, pick) {
  const text = await readStoredText(filePath);

  if (text === null) {
    return null;
  }

  try {
    const value = pick(JSON.parse(text));
    return typeof value === "string" && value ? value : null;
  } catch {
    return null;
  }
}

// 화면 폴더의 신원은 Figma 노드 id다. screenId를 잘못 지정한 채 저장하면
// 원본·자산 11개·reference.png가 한꺼번에 다른 화면 것으로 바뀌고,
// reference.png는 시각 검증의 유일한 기준이라 어떤 검사도 이를 잡지 못한다.
async function assertScreenFolderIdentity({ filePath, incomingNodeId, screenId }) {
  if (typeof incomingNodeId !== "string" || !incomingNodeId) {
    return;
  }

  const directory = dirname(filePath);
  const knownNodeId =
    (await readJsonField(
      join(directory, "figma.raw.json"),
      (value) => value?.document?.id
    )) ??
    (await readJsonField(
      join(directory, "screen.json"),
      (value) => value?.source?.nodeId
    ));

  if (knownNodeId !== null && knownNodeId !== incomingNodeId) {
    throw new HttpError(
      409,
      "screen_identity_mismatch",
      `'${screenId}' 폴더는 Figma 노드 ${knownNodeId}의 산출물입니다. 지금 저장하려는 화면은 ${incomingNodeId}이라 덮어쓰지 않았습니다. 작업 화면의 screenId를 확인하세요.`
    );
  }
}

function assertWriteRevision(request, storedText) {
  const ifMatch = String(request.headers["if-match"] ?? "").trim();
  const ifNoneMatch = String(
    request.headers["if-none-match"] ?? ""
  ).trim();
  const currentRevision =
    storedText === null ? null : createRevision(storedText);

  const hasRevisionConflict =
    (ifNoneMatch === "*" && storedText !== null) ||
    (ifMatch && ifMatch !== currentRevision);

  if (hasRevisionConflict) {
    throw new HttpError(
      412,
      "revision_conflict",
      "로컬 JSON이 변경되었습니다. 최신 초안을 다시 불러오세요."
    );
  }
}

async function writeDataAtomically(filePath, data) {
  const directory = dirname(filePath);
  const tempPath = join(
    directory,
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(
      tempPath,
      data,
      Buffer.isBuffer(data) ? { flag: "wx" } : { encoding: "utf8", flag: "wx" }
    );
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }

  return data;
}

async function writeJsonAtomically(filePath, value) {
  return writeDataAtomically(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function handleGetScreen(response, filePath) {
  const text = await readStoredText(filePath);

  if (text === null) {
    throw new HttpError(
      404,
      "screen_not_found",
      "저장된 화면 JSON을 찾을 수 없습니다."
    );
  }

  let screenSpec;
  try {
    screenSpec = JSON.parse(text);
  } catch {
    throw new HttpError(
      500,
      "invalid_stored_json",
      "저장된 화면 JSON이 올바르지 않습니다."
    );
  }

  response.setHeader("ETag", createRevision(text));
  sendJson(response, 200, screenSpec);
}

async function handleGetOptionSources(response, filePath) {
  const text = await readStoredText(filePath);

  if (text === null) {
    throw new HttpError(
      404,
      "option_sources_not_found",
      "옵션 출처 카탈로그를 찾을 수 없습니다."
    );
  }

  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch {
    throw new HttpError(
      500,
      "invalid_stored_json",
      "저장된 옵션 출처 카탈로그가 올바르지 않습니다."
    );
  }

  response.setHeader("ETag", createRevision(text));
  sendJson(response, 200, catalog);
}

async function handleGetStateScopes(response, filePath) {
  const text = await readStoredText(filePath);

  if (text === null) {
    throw new HttpError(
      404,
      "state_scopes_not_found",
      "상태 스코프 카탈로그를 찾을 수 없습니다."
    );
  }

  let catalog;
  try {
    catalog = JSON.parse(text);
  } catch {
    throw new HttpError(
      500,
      "invalid_stored_json",
      "저장된 상태 스코프 카탈로그가 올바르지 않습니다."
    );
  }

  response.setHeader("ETag", createRevision(text));
  sendJson(response, 200, catalog);
}

async function handlePutScreen({
  request,
  response,
  filePath,
  screenId,
  maxBodyBytes,
  wireframeKey
}) {
  const contentType = String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    request.resume();
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type은 application/json이어야 합니다."
    );
  }

  const storedText = await readStoredText(filePath);
  try {
    assertWriteRevision(request, storedText);
  } catch (error) {
    request.resume();
    throw error;
  }

  const body = await readRequestBody(request, maxBodyBytes);
  const screenSpec = parseScreenSpecJson(body, screenId);
  await assertScreenFolderIdentity({
    filePath,
    incomingNodeId: screenSpec.source?.nodeId,
    screenId
  });
  const savedText = await writeJsonAtomically(filePath, screenSpec);

  response.setHeader("ETag", createRevision(savedText));
  sendJson(response, 200, {
    screenId,
    status: "saved",
    wireframeKey
  });
}

async function handlePutFigmaRaw({
  request,
  response,
  filePath,
  screenId,
  maxBodyBytes,
  wireframeKey
}) {
  const contentType = String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    request.resume();
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type은 application/json이어야 합니다."
    );
  }

  const body = await readRequestBody(
    request,
    maxBodyBytes,
    "Figma 원본 JSON은 25MB를 넘을 수 없습니다."
  );
  const raw = parseFigmaRawJson(body);
  // 원본이 먼저 저장되고 실패 시 자산·reference 저장이 중단되므로,
  // 여기서 막으면 번들 전체가 어긋난 폴더에 쓰이는 것을 막을 수 있다.
  await assertScreenFolderIdentity({
    filePath,
    incomingNodeId: raw.document?.id,
    screenId
  });
  await writeJsonAtomically(filePath, raw);

  sendJson(response, 200, {
    artifact: "figma.raw.json",
    screenId,
    status: "saved",
    wireframeKey
  });
}

async function handlePutScreenAsset({
  request,
  response,
  filePath,
  fileName,
  screenId,
  maxBodyBytes,
  wireframeKey
}) {
  const contentType = String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  const extension = fileName.slice(fileName.lastIndexOf(".") + 1);
  const expectedType = ASSET_CONTENT_TYPE[extension];

  if (contentType !== expectedType) {
    request.resume();
    throw new HttpError(
      415,
      "unsupported_media_type",
      `${fileName}의 Content-Type은 ${expectedType}이어야 합니다.`
    );
  }

  const body = await readRequestBody(
    request,
    maxBodyBytes,
    "자산은 1MB를 넘을 수 없습니다.",
    { binary: extension === "png" }
  );

  if (extension === "svg" && !body.includes("<svg")) {
    throw new HttpError(
      400,
      "invalid_svg",
      "요청 본문이 올바른 SVG가 아닙니다."
    );
  }
  // PNG는 시그니처로 확인한다. 잘못된 바이트를 조용히 저장하면 화면이 깨진
  // 이미지를 그리고 원인은 파일에 남지 않는다.
  if (
    extension === "png" &&
    (body.length < PNG_SIGNATURE.length ||
      !body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE))
  ) {
    throw new HttpError(400, "invalid_png", "요청 본문이 올바른 PNG가 아닙니다.");
  }

  await writeDataAtomically(filePath, body);

  sendJson(response, 200, {
    artifact: `assets/${fileName}`,
    screenId,
    status: "saved",
    wireframeKey
  });
}

async function handlePutScreenReference({
  request,
  response,
  filePath,
  screenId,
  maxBodyBytes,
  wireframeKey
}) {
  const contentType = String(request.headers["content-type"] ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "image/png") {
    request.resume();
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type은 image/png이어야 합니다."
    );
  }

  const body = await readRequestBody(
    request,
    maxBodyBytes,
    "참조 PNG는 25MB를 넘을 수 없습니다.",
    { binary: true }
  );

  if (
    body.length < PNG_SIGNATURE.length ||
    !body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
  ) {
    throw new HttpError(
      400,
      "invalid_png",
      "요청 본문이 올바른 PNG가 아닙니다."
    );
  }

  await writeDataAtomically(filePath, body);

  sendJson(response, 200, {
    artifact: "reference.png",
    screenId,
    status: "saved",
    wireframeKey
  });
}

export function createSpecServer({
  specsRoot = DEFAULT_SPECS_ROOT,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  maxFigmaRawBodyBytes = DEFAULT_MAX_FIGMA_RAW_BODY_BYTES
} = {}) {
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes <= 0) {
    throw new TypeError("maxBodyBytes는 양의 정수여야 합니다.");
  }
  if (
    !Number.isSafeInteger(maxFigmaRawBodyBytes) ||
    maxFigmaRawBodyBytes <= 0
  ) {
    throw new TypeError("maxFigmaRawBodyBytes는 양의 정수여야 합니다.");
  }

  const absoluteSpecsRoot = resolve(specsRoot);

  return createServer((request, response) => {
    const originCheck = resolveRequestOrigin(request);
    setCorsHeaders(response, originCheck.origin);

    void (async () => {
      if (!originCheck.allowed) {
        request.resume();
        throw new HttpError(
          403,
          "forbidden_origin",
          "허용되지 않은 Origin입니다. 브리지는 Figma 플러그인과 로컬 도구의 요청만 받습니다."
        );
      }

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      const { pathname } = new URL(
        request.url ?? "/",
        "http://127.0.0.1"
      );

      if (request.method === "GET" && pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      const stateScopesRoute = parseStateScopesRoute(request.url);
      if (stateScopesRoute !== null) {
        if (request.method !== "GET") {
          request.resume();
          response.setHeader("Allow", "GET, OPTIONS");
          throw new HttpError(
            405,
            "method_not_allowed",
            "지원하지 않는 HTTP 메서드입니다."
          );
        }

        await handleGetStateScopes(
          response,
          resolveStateScopesPath({
            specsRoot: absoluteSpecsRoot,
            ...stateScopesRoute
          })
        );
        return;
      }

      const optionSourcesRoute = parseOptionSourcesRoute(request.url);
      if (optionSourcesRoute !== null) {
        if (request.method !== "GET") {
          request.resume();
          response.setHeader("Allow", "GET, OPTIONS");
          throw new HttpError(
            405,
            "method_not_allowed",
            "지원하지 않는 HTTP 메서드입니다."
          );
        }

        await handleGetOptionSources(
          response,
          resolveOptionSourcesPath({
            specsRoot: absoluteSpecsRoot,
            ...optionSourcesRoute
          })
        );
        return;
      }

      const screenAssetRoute = parseScreenAssetRoute(request.url);
      if (screenAssetRoute !== null) {
        if (request.method !== "PUT") {
          request.resume();
          response.setHeader("Allow", "PUT, OPTIONS");
          throw new HttpError(
            405,
            "method_not_allowed",
            "지원하지 않는 HTTP 메서드입니다."
          );
        }

        await handlePutScreenAsset({
          request,
          response,
          filePath: resolveScreenAssetPath({
            specsRoot: absoluteSpecsRoot,
            ...screenAssetRoute
          }),
          maxBodyBytes,
          ...screenAssetRoute
        });
        return;
      }

      const screenReferenceRoute = parseScreenReferenceRoute(request.url);
      if (screenReferenceRoute !== null) {
        if (request.method !== "PUT") {
          request.resume();
          response.setHeader("Allow", "PUT, OPTIONS");
          throw new HttpError(
            405,
            "method_not_allowed",
            "지원하지 않는 HTTP 메서드입니다."
          );
        }

        await handlePutScreenReference({
          request,
          response,
          filePath: resolveScreenReferencePath({
            specsRoot: absoluteSpecsRoot,
            ...screenReferenceRoute
          }),
          maxBodyBytes: maxFigmaRawBodyBytes,
          ...screenReferenceRoute
        });
        return;
      }

      const figmaRawRoute = parseFigmaRawRoute(request.url);
      if (figmaRawRoute !== null) {
        if (request.method !== "PUT") {
          request.resume();
          response.setHeader("Allow", "PUT, OPTIONS");
          throw new HttpError(
            405,
            "method_not_allowed",
            "지원하지 않는 HTTP 메서드입니다."
          );
        }

        await handlePutFigmaRaw({
          request,
          response,
          filePath: resolveFigmaRawPath({
            specsRoot: absoluteSpecsRoot,
            ...figmaRawRoute
          }),
          maxBodyBytes: maxFigmaRawBodyBytes,
          ...figmaRawRoute
        });
        return;
      }

      const route = parseScreenRoute(request.url);
      if (route === null) {
        throw new HttpError(
          404,
          "route_not_found",
          "요청한 API 경로를 찾을 수 없습니다."
        );
      }

      const filePath = resolveScreenSpecPath({
        specsRoot: absoluteSpecsRoot,
        ...route
      });

      if (request.method === "GET") {
        await handleGetScreen(response, filePath);
        return;
      }

      if (request.method === "PUT") {
        await handlePutScreen({
          request,
          response,
          filePath,
          maxBodyBytes,
          ...route
        });
        return;
      }

      request.resume();
      response.setHeader("Allow", "GET, PUT, OPTIONS");
      throw new HttpError(
        405,
        "method_not_allowed",
        "지원하지 않는 HTTP 메서드입니다."
      );
    })().catch((error) => sendError(response, error));
  });
}

export async function startSpecServer({
  port = DEFAULT_PORT,
  specsRoot = DEFAULT_SPECS_ROOT
} = {}) {
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("port는 1부터 65535 사이의 정수여야 합니다.");
  }

  const server = createSpecServer({ specsRoot });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, DEFAULT_HOST, resolveListen);
  });

  return { server, specsRoot: resolve(specsRoot) };
}
