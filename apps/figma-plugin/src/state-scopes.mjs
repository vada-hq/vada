const STATE_SCOPE_LIFETIMES = new Set(["flow"]);
const STATE_SCOPE_CLEAR_EVENTS = new Set(["complete", "cancel"]);
const STATE_SCOPE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

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

export function normalizeStateScopeKey(value) {
  const key = requireNonEmptyString(value, "stateScopeKey가 필요합니다.");

  if (!STATE_SCOPE_KEY_PATTERN.test(key)) {
    throw new TypeError("stateScopeKey 형식이 올바르지 않습니다.");
  }

  return key;
}

function normalizeScope(scope) {
  requireObject(scope, "상태 스코프는 객체여야 합니다.");

  const key = normalizeStateScopeKey(scope.key);
  const lifetime = requireNonEmptyString(
    scope.lifetime,
    `${key}의 lifetime이 필요합니다.`
  );

  if (!STATE_SCOPE_LIFETIMES.has(lifetime)) {
    throw new TypeError(`${key}의 lifetime은 flow여야 합니다.`);
  }
  if (!Array.isArray(scope.clearOn) || scope.clearOn.length === 0) {
    throw new TypeError(`${key}의 clearOn은 비어 있지 않은 배열이어야 합니다.`);
  }

  const clearOn = scope.clearOn.map((eventName) => {
    const normalizedEvent = requireNonEmptyString(
      eventName,
      `${key}의 clearOn 이벤트가 필요합니다.`
    );

    if (!STATE_SCOPE_CLEAR_EVENTS.has(normalizedEvent)) {
      throw new TypeError(
        `${key}의 clearOn 이벤트는 complete 또는 cancel이어야 합니다.`
      );
    }

    return normalizedEvent;
  });

  if (new Set(clearOn).size !== clearOn.length) {
    throw new Error(`${key}의 clearOn 이벤트가 중복되었습니다.`);
  }

  return {
    key,
    description: requireNonEmptyString(
      scope.description,
      `${key}의 description이 필요합니다.`
    ),
    lifetime,
    clearOn
  };
}

export function normalizeStateScopeCatalog(value) {
  const catalog = requireObject(value, "상태 스코프 카탈로그는 객체여야 합니다.");

  if (catalog.schemaVersion !== 1) {
    throw new Error("지원하지 않는 상태 스코프 schemaVersion입니다.");
  }
  if (!Array.isArray(catalog.scopes)) {
    throw new TypeError("상태 스코프 카탈로그의 scopes는 배열이어야 합니다.");
  }

  const scopes = catalog.scopes.map(normalizeScope);
  const seenKeys = new Set();

  for (const scope of scopes) {
    if (seenKeys.has(scope.key)) {
      throw new Error(`상태 스코프 key가 중복되었습니다: ${scope.key}`);
    }
    seenKeys.add(scope.key);
  }

  return { schemaVersion: 1, scopes };
}

export function findStateScopeByKey(catalog, key) {
  if (typeof key !== "string" || key === "") {
    return null;
  }

  return catalog?.scopes?.find((scope) => scope.key === key) ?? null;
}
