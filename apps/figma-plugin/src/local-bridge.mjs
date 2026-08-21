
export const LOCAL_SPEC_SERVICE_ORIGIN = "http://localhost:3846";

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name}가 필요합니다.`);
  }

  return value.trim();
}

export function getLocalScreenSpecUrl({
  wireframeKey,
  screenId,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const normalizedWireframeKey = requireNonEmptyString(
    wireframeKey,
    "wireframeKey"
  );
  const normalizedScreenId = requireNonEmptyString(screenId, "screenId");

  return `${origin}/v1/screens/${encodeURIComponent(
    normalizedWireframeKey
  )}/${encodeURIComponent(normalizedScreenId)}`;
}

export function getLocalFigmaRawUrl({
  wireframeKey,
  screenId,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  return `${getLocalScreenSpecUrl({
    wireframeKey,
    screenId,
    origin
  })}/figma-raw`;
}

export function getLocalScreenAssetUrl({
  wireframeKey,
  screenId,
  fileName,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const normalizedFileName = requireNonEmptyString(fileName, "fileName");

  return `${getLocalScreenSpecUrl({
    wireframeKey,
    screenId,
    origin
  })}/assets/${encodeURIComponent(normalizedFileName)}`;
}

export function getLocalScreenReferenceUrl({
  wireframeKey,
  screenId,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  return `${getLocalScreenSpecUrl({
    wireframeKey,
    screenId,
    origin
  })}/reference`;
}

export function getLocalOptionSourcesUrl({
  wireframeKey,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const normalizedWireframeKey = requireNonEmptyString(
    wireframeKey,
    "wireframeKey"
  );

  return `${origin}/v1/option-sources/${encodeURIComponent(
    normalizedWireframeKey
  )}`;
}

export function getLocalStateScopesUrl({
  wireframeKey,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const normalizedWireframeKey = requireNonEmptyString(
    wireframeKey,
    "wireframeKey"
  );

  return `${origin}/v1/state-scopes/${encodeURIComponent(
    normalizedWireframeKey
  )}`;
}

async function getResponseErrorMessage(
  response,
  fallbackMessage = "로컬 파일 요청에 실패했습니다."
) {
  try {
    const body = await response.json();
    if (typeof body?.error?.message === "string") {
      return body.error.message;
    }
  } catch {
    // 응답 본문을 읽지 못하면 HTTP 상태만 사용한다.
  }

  return `${fallbackMessage} (HTTP ${response.status})`;
}

function getResponseRevision(response) {
  return response.headers?.get?.("etag") ?? null;
}

export async function loadScreenSpecFromLocal({
  wireframeKey,
  screenId,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const url = getLocalScreenSpecUrl({ wireframeKey, screenId, origin });

  let response;
  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 시도하세요."
    );
  }

  if (response.status === 404) {
    return { screenSpec: null, revision: null, status: "missing" };
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "로컬 화면 JSON을 불러오지 못했습니다."
      )
    );
  }

  const screenSpec = await response.json();

  if (!screenSpec || typeof screenSpec !== "object" || Array.isArray(screenSpec)) {
    throw new Error("로컬 화면 JSON은 객체여야 합니다.");
  }

  return {
    screenSpec,
    revision: getResponseRevision(response),
    status: "loaded"
  };
}

export async function loadOptionSourcesFromLocal({
  wireframeKey,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const url = getLocalOptionSourcesUrl({ wireframeKey, origin });

  let response;
  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 시도하세요."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "옵션 출처 카탈로그를 불러오지 못했습니다."
      )
    );
  }

  const catalog = await response.json();

  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("옵션 출처 카탈로그는 객체여야 합니다.");
  }

  return catalog;
}

export async function loadStateScopesFromLocal({
  wireframeKey,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const url = getLocalStateScopesUrl({ wireframeKey, origin });

  let response;
  try {
    response = await fetchImpl(url, { method: "GET" });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 시도하세요."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "상태 스코프 카탈로그를 불러오지 못했습니다."
      )
    );
  }

  const catalog = await response.json();

  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("상태 스코프 카탈로그는 객체여야 합니다.");
  }

  return catalog;
}

export async function saveFigmaRawToLocal({
  wireframeKey,
  screenId,
  raw,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("저장할 Figma 원본 JSON 객체가 필요합니다.");
  }

  const url = getLocalFigmaRawUrl({ wireframeKey, screenId, origin });

  let body;
  try {
    body = `${JSON.stringify(raw, null, 2)}\n`;
  } catch {
    throw new Error("Figma 원본 JSON을 직렬화할 수 없습니다.");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body
    });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 저장하세요."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "Figma 원본 JSON을 저장하지 못했습니다."
      )
    );
  }

  return response.json();
}

// 자산은 벡터(SVG 문자열)와 래스터(PNG 바이트) 둘 다 있다.
export async function saveFigmaAssetToLocal({
  wireframeKey,
  screenId,
  fileName,
  svg,
  bytes,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  const isPng = bytes !== undefined;
  if (isPng) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
      throw new Error("저장할 PNG 바이트가 필요합니다.");
    }
  } else if (typeof svg !== "string" || !svg.includes("<svg")) {
    throw new Error("저장할 SVG 본문이 필요합니다.");
  }

  const url = getLocalScreenAssetUrl({
    wireframeKey,
    screenId,
    fileName,
    origin
  });

  let response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: { "Content-Type": isPng ? "image/png" : "image/svg+xml" },
      body: isPng ? bytes : svg
    });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 저장하세요."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "벡터 SVG 자산을 저장하지 못했습니다."
      )
    );
  }

  return response.json();
}

export async function saveFigmaReferenceToLocal({
  wireframeKey,
  screenId,
  png,
  fetchImpl = globalThis.fetch,
  origin = LOCAL_SPEC_SERVICE_ORIGIN
}) {
  if (!(png instanceof Uint8Array) || png.length === 0) {
    throw new Error("저장할 참조 PNG가 필요합니다.");
  }

  const url = getLocalScreenReferenceUrl({ wireframeKey, screenId, origin });

  let response;
  try {
    response = await fetchImpl(url, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: png
    });
  } catch {
    throw new Error(
      "로컬 브리지에 연결할 수 없습니다. spec-service를 실행한 뒤 다시 저장하세요."
    );
  }

  if (!response.ok) {
    throw new Error(
      await getResponseErrorMessage(
        response,
        "화면 참조 PNG를 저장하지 못했습니다."
      )
    );
  }

  return response.json();
}
