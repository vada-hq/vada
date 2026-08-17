const OPTION_SOURCE_TYPES = new Set(["static", "remote"]);
const OPTION_SOURCE_LOAD_EVENTS = new Set(["search", "open"]);
const OPTION_SOURCE_SEARCH_MODES = new Set(["remote", "client"]);
const OPTION_SOURCE_MESSAGE_KEYS = ["idle", "loading", "empty", "error"];

function requireObject(value, message) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }

  return value;
}

function requireNonEmptyString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(message);
  }

  return value.trim();
}

function requireInteger(value, minimum, message) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new TypeError(message);
  }

  return value;
}

function normalizeOption(option, sourceKey) {
  requireObject(option, `${sourceKey}의 option은 객체여야 합니다.`);

  if (
    !["string", "number", "boolean"].includes(typeof option.value) ||
    (typeof option.value === "number" && !Number.isFinite(option.value))
  ) {
    throw new TypeError(`${sourceKey}의 option.value가 올바르지 않습니다.`);
  }

  const normalized = {
    value: option.value,
    label: requireNonEmptyString(
      option.label,
      `${sourceKey}의 option.label이 필요합니다.`
    )
  };

  if (option.disabled !== undefined) {
    if (typeof option.disabled !== "boolean") {
      throw new TypeError(
        `${sourceKey}의 option.disabled는 boolean이어야 합니다.`
      );
    }
    normalized.disabled = option.disabled;
  }

  return normalized;
}

function normalizeSearch(search, sourceKey) {
  const value = requireObject(
    search,
    `${sourceKey}의 request.search가 필요합니다.`
  );
  const mode = requireNonEmptyString(
    value.mode,
    `${sourceKey}의 request.search.mode가 필요합니다.`
  );

  if (!OPTION_SOURCE_SEARCH_MODES.has(mode)) {
    throw new TypeError(
      `${sourceKey}의 request.search.mode는 remote 또는 client여야 합니다.`
    );
  }
  if (mode === "client") {
    return { mode };
  }

  return {
    mode,
    queryParam: requireNonEmptyString(
      value.queryParam,
      `${sourceKey}의 request.search.queryParam이 필요합니다.`
    ),
    minLength: requireInteger(
      value.minLength,
      1,
      `${sourceKey}의 request.search.minLength는 1 이상의 정수여야 합니다.`
    ),
    debounceMs: requireInteger(
      value.debounceMs,
      0,
      `${sourceKey}의 request.search.debounceMs는 0 이상의 정수여야 합니다.`
    )
  };
}

function normalizeRequest(request, sourceKey) {
  const value = requireObject(
    request,
    `${sourceKey}의 request가 필요합니다.`
  );
  const method = requireNonEmptyString(
    value.method,
    `${sourceKey}의 request.method가 필요합니다.`
  );
  const path = requireNonEmptyString(
    value.path,
    `${sourceKey}의 request.path가 필요합니다.`
  );
  const loadOn = requireNonEmptyString(
    value.loadOn,
    `${sourceKey}의 request.loadOn이 필요합니다.`
  );

  if (method !== "GET") {
    throw new TypeError(`${sourceKey}의 request.method는 GET이어야 합니다.`);
  }
  if (!path.startsWith("/")) {
    throw new TypeError(`${sourceKey}의 request.path는 /로 시작해야 합니다.`);
  }
  if (!OPTION_SOURCE_LOAD_EVENTS.has(loadOn)) {
    throw new TypeError(
      `${sourceKey}의 request.loadOn은 search 또는 open이어야 합니다.`
    );
  }

  const search =
    value.search === undefined
      ? undefined
      : normalizeSearch(value.search, sourceKey);
  if (loadOn === "search" && search?.mode !== "remote") {
    throw new TypeError(
      `${sourceKey}의 search 호출은 remote 검색 계약이어야 합니다.`
    );
  }

  return search
    ? { method, path, loadOn, search }
    : { method, path, loadOn };
}

function normalizeMessages(messages, sourceKey) {
  const value = requireObject(
    messages,
    `${sourceKey}의 messages가 필요합니다.`
  );
  return Object.fromEntries(
    OPTION_SOURCE_MESSAGE_KEYS.map((key) => [
      key,
      requireNonEmptyString(
        value[key],
        `${sourceKey}의 messages.${key}가 필요합니다.`
      )
    ])
  );
}

function normalizeSource(source) {
  requireObject(source, "옵션 출처는 객체여야 합니다.");

  const key = requireNonEmptyString(source.key, "옵션 출처 key가 필요합니다.");
  const type = requireNonEmptyString(
    source.type,
    `${key}의 type이 필요합니다.`
  );

  if (!OPTION_SOURCE_TYPES.has(type)) {
    throw new TypeError(`${key}의 type은 static 또는 remote여야 합니다.`);
  }
  if (!Array.isArray(source.params)) {
    throw new TypeError(`${key}의 params는 배열이어야 합니다.`);
  }

  const params = source.params.map((param) =>
    requireNonEmptyString(param, `${key}의 param 이름이 필요합니다.`)
  );
  if (new Set(params).size !== params.length) {
    throw new Error(`${key}의 params가 중복되었습니다.`);
  }

  const normalized = {
    key,
    type,
    description: requireNonEmptyString(
      source.description,
      `${key}의 description이 필요합니다.`
    ),
    params
  };

  if (type === "static") {
    if (!Array.isArray(source.options) || source.options.length === 0) {
      throw new TypeError(`${key}의 options가 필요합니다.`);
    }
    if (source.request !== undefined || source.messages !== undefined) {
      throw new TypeError(`${key}의 static 출처에는 원격 계약을 둘 수 없습니다.`);
    }
    normalized.options = source.options.map((option) =>
      normalizeOption(option, key)
    );
  } else {
    if (source.options !== undefined) {
      throw new TypeError(`${key}의 remote 출처에는 options를 둘 수 없습니다.`);
    }
    normalized.request = normalizeRequest(source.request, key);
    normalized.messages = normalizeMessages(source.messages, key);
  }

  return normalized;
}

export function normalizeOptionSourceCatalog(value) {
  const catalog = requireObject(
    value,
    "옵션 출처 카탈로그는 객체여야 합니다."
  );

  if (catalog.schemaVersion !== 2) {
    throw new Error("지원하지 않는 옵션 출처 schemaVersion입니다.");
  }
  if (!Array.isArray(catalog.sources)) {
    throw new TypeError("옵션 출처 카탈로그의 sources는 배열이어야 합니다.");
  }

  const sources = catalog.sources.map(normalizeSource);
  const seenKeys = new Set();
  for (const source of sources) {
    if (seenKeys.has(source.key)) {
      throw new Error(`옵션 출처 key가 중복되었습니다: ${source.key}`);
    }
    seenKeys.add(source.key);
  }

  return { schemaVersion: 2, sources };
}

export function findOptionSourceByKey(catalog, key) {
  if (typeof key !== "string" || key === "") {
    return null;
  }

  return catalog?.sources?.find((source) => source.key === key) ?? null;
}

export function filterOptionSourceOptions(options, query) {
  const normalizedOptions = Array.isArray(options) ? options : [];
  const normalizedQuery =
    typeof query === "string" ? query.trim().toLowerCase() : "";

  if (!normalizedQuery) {
    return normalizedOptions;
  }

  return normalizedOptions.filter((option) =>
    [option?.value, option?.label].some((value) =>
      String(value ?? "").toLowerCase().includes(normalizedQuery)
    )
  );
}

export function getOptionSourceReadiness(
  source,
  { searchable = false, params = {}, availableFieldKeys } = {}
) {
  const issues = [];

  if (!source || typeof source !== "object") {
    return {
      ready: false,
      issues: ["카탈로그에서 선택지 출처를 찾을 수 없습니다."]
    };
  }

  const mappings =
    params && typeof params === "object" && !Array.isArray(params)
      ? params
      : {};
  for (const paramName of source.params ?? []) {
    const fieldKey = mappings[paramName];
    if (typeof fieldKey !== "string" || fieldKey.trim() === "") {
      issues.push(`${paramName} 인자에 화면 fieldKey를 연결해야 합니다.`);
    } else if (
      Array.isArray(availableFieldKeys) &&
      !availableFieldKeys.includes(fieldKey)
    ) {
      issues.push(`${paramName} 인자가 등록되지 않은 fieldKey를 가리킵니다.`);
    }
  }

  if (source.type === "static") {
    if (!Array.isArray(source.options) || source.options.length === 0) {
      issues.push("정적 선택지가 필요합니다.");
    }
  } else if (source.type === "remote") {
    if (!source.request || !source.messages) {
      issues.push("원격 요청과 상태 메시지 계약이 필요합니다.");
    }
    if (source.request?.search && searchable !== true) {
      issues.push("검색 계약을 사용하려면 searchable이 true여야 합니다.");
    }
  }

  return { ready: issues.length === 0, issues };
}
