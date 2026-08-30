// 카탈로그를 OpenAPI로 옮긴다.
//
// 명세는 이미 method·path·인자·조각·값의 종류를 갖고 있다. OpenAPI는 그것을 **다른
// 말로 적은 것**이지 새 사실이 아니다. 그래서 손으로 쓰지 않는다 — 두 벌을 손으로
// 들면 갈리고, 갈리는 것을 막으려고 만든 체계가 갈릴 자리를 새로 만드는 셈이다.
//
// 나오는 것을 세 곳이 쓴다. 프론트의 타입·클라이언트, 백엔드의 서버 뼈대,
// API Gateway의 import. 셋이 한 원본에서 나오면 어긋날 수가 없다.
//
// **3.1이 아니라 3.0.3을 낸다.** 3.1은 JSON Schema 2020-12와 같아 이 저장소의
// ajv와 결이 맞지만, 이것을 받아 가는 쪽 중 하나가 API Gateway이고 그쪽의 가져오기가
// 3.0을 기준으로 삼는다. 지금 명세에 3.1이라야 적을 수 있는 것이 없으므로,
// 표현력을 잃지 않으면서 받는 쪽을 넓게 두는 편을 고른다.
//
// **없는 것도 적어 둔다.** 인증·오류 코드·쪽 나눔 규약은 명세에 없다. 지어내지
// 않고 자리만 비워 둔다 — 여기서 지어내면 그 거짓이 서버까지 간다.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function read(...parts) {
  return JSON.parse(readFileSync(join(repoRoot, ...parts), "utf-8"));
}

/** 경로에 `{이름}`으로 박힌 인자들. 나머지는 조회 인자다. */
function pathParams(path) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
}

/** 조각 하나를 스키마로. 되풀이되는 조각은 안으로 들어간다. */
function fieldSchema(field) {
  if (Array.isArray(field.fields)) {
    return {
      type: "array",
      description: field.description,
      items: objectSchema(field.fields)
    };
  }
  return { type: field.valueType, description: field.description };
}

function objectSchema(fields) {
  const properties = {};
  const required = [];
  for (const field of fields) {
    properties[field.key] = fieldSchema(field);
    // optional은 '없으면 오지 않는다'는 뜻이다. null로 오지 않는다.
    if (field.optional !== true) required.push(field.key);
  }
  const schema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

// 인자를 OpenAPI의 parameter로. **없어도 되는지는 카탈로그가 안다.**
//
// 오랫동안 조회 인자를 전부 `required: false`로 냈다. 그러면 '어느 행사인가'를
// 빼고 부르는 것이 계약상 허용되고, 그 답은 **거르지 않은 전부**다 — 화면은 그것을
// 걸러진 것인 줄 알고 그린다. 명세가 인자마다 required를 갖게 되어 여기서 옮긴다.
// 이 자리를 누가 열 수 있는가. **표준에 자리가 없어 확장으로 낸다** — OpenAPI의
// security는 '어떻게 인증하는가'를 말하지 벽 안에서 '누가 되는가'를 말하지 않는다.
//
// 받아 가는 쪽이 이것을 읽어야 하는 까닭: 자리마다 사람이 스스로 판단하면 판단을
// 빠뜨린 자리가 조용히 열린다. 규칙은 permissions.json 하나에 있고 여기는 그것을
// 가리키기만 한다.
function authorizeOf(item) {
  const authorize = item.authorize;
  if (authorize === undefined) return undefined;
  return authorize.object === undefined
    ? { area: authorize.area }
    : { area: authorize.area, object: authorize.object };
}

function parametersOf(path, declared) {
  const inPath = new Set(pathParams(path));
  const byName = new Map((declared ?? []).map((param) => [param.key, param]));
  const out = [];
  for (const name of inPath) {
    const param = byName.get(name);
    // **지어내지 않는다.** 선언되지 않은 자리를 만나면 설명 없는 문자열로 채우는
    // 대신 멈춘다 — 변이 27개의 경로 인자 29자리가 그렇게 조용히 채워지고 있었다.
    if (param === undefined) {
      throw new Error(
        `경로 '${path}'에 '{${name}}' 자리가 있는데 명세가 그 인자를 선언하지 않았습니다.`
      );
    }
    // 경로에 박힌 것은 뺄 수가 없다. 카탈로그가 뭐라 적었든 required다.
    out.push({
      name,
      in: "path",
      required: true,
      description: param.description,
      schema: { type: param.valueType }
    });
  }
  for (const param of declared ?? []) {
    if (inPath.has(param.key)) continue;
    out.push({
      name: param.key,
      in: "query",
      required: param.required,
      description: param.description,
      schema: { type: param.valueType }
    });
  }
  return out;
}

/** 상태 스코프에 담기는 칸들. 화면의 명세가 이미 말한다. */
function fieldsByScope() {
  const screensDir = join(repoRoot, "specs", "figma", "vada-wireframe", "screens");
  const byScope = new Map();
  for (const entry of readdirSync(screensDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let spec;
    try {
      spec = JSON.parse(
        readFileSync(join(screensDir, entry.name, "screen.json"), "utf-8")
      );
    } catch {
      continue;
    }
    const scope = spec.stateScopeKey;
    if (typeof scope !== "string") continue;
    const fields = byScope.get(scope) ?? new Map();
    const walk = (node) => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (node === null || typeof node !== "object") return;
      const key = node.fieldKey;
      if (typeof key === "string" && ["input", "select", "list"].includes(node.type)) {
        fields.set(key, {
          type: node.type === "list" ? "array" : (node.valueType ?? "string"),
          required: node.required === true,
          label: node.label ?? node.itemNoun ?? key
        });
      }
      for (const value of Object.values(node)) walk(value);
    };
    walk(spec);
    byScope.set(scope, fields);
  }
  return byScope;
}

function bodySchema(scopeKey, byScope) {
  const fields = byScope.get(scopeKey);
  if (fields === undefined || fields.size === 0) {
    // FIN-SUP-01이 그렇다 — 무엇을 받을지 서버가 정하고 화면은 그 목록을 받아
    // 그린다. 명세가 칸을 모르므로 여기서도 모른다고 적는다.
    return {
      type: "object",
      additionalProperties: true,
      description:
        `상태 스코프 '${scopeKey}'에 담긴 값. **칸의 목록을 명세가 모른다** — ` +
        "서버가 무엇을 받을지 정해 내려보내고 화면은 그대로 그린다."
    };
  }
  const properties = {};
  const required = [];
  for (const [key, field] of fields) {
    properties[key] =
      field.type === "array"
        ? { type: "array", items: { type: "object" }, description: field.label }
        : { type: field.type, description: field.label };
    if (field.required) required.push(key);
  }
  const schema = { type: "object", properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

const ERROR_SCHEMA = {
  type: "object",
  description:
    "실패했을 때 오는 것. **무엇이 잘못됐는지는 상태 코드가 말하고, 사람에게 보일 글은 " +
    "여기 담긴다.** 한동안 '아직 정하지 않았다'로 자리만 비워 두었는데 이제 정해졌다 — " +
    "코드는 자리마다 손으로 적지 않고 **명세에서 끌어낸다.** 권한 영역이 401·403을, 자리에 " +
    "박힌 인자가 404를, 되풀이될 때의 성질이 409를, 보내는 값이 있으면 422를, 로그인 없이 " +
    "열리는 자리가 429를 말한다. **조각을 더 두지 않는다** — 어느 칸이 틀렸는지를 담을 " +
    "어휘가 아직 없고, 지어내면 그 거짓이 서버까지 간다(화면은 보내기 전에 이미 필수 칸을 본다).",
  properties: {
    message: { type: "string", description: "사람에게 보일 글" }
  },
  required: ["message"]
};

const ERROR_BODY = {
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
};

/**
 * 이 자리가 무엇으로 실패하는가. **짐작하지 않고 명세에서 끌어낸다.**
 *
 * 216자리가 오랫동안 `200` 하나만 들고 있었다. 그러면 받는 쪽은 실패를 다룰 수 없고,
 * 다룰 수 없는 실패는 화면에 '알 수 없는 오류'로 나온다.
 *
 * 여기서 새로 정하는 것은 없다. 권한 영역이 401·403을 말하고, 자리에 박힌 인자가
 * 404를 말하고, 되풀이될 때의 성질이 409를 말하고, 보내는 값이 있으면 422가 있다.
 * **파생이라 갈릴 수가 없다** — 자리마다 손으로 적으면 언젠가 하나가 빠진다.
 */
function failures({ area, path, params, hasBody, repeatKind, shape }) {
  const out = {};
  const isPublic = area === "public";

  if (!isPublic) {
    out[401] = { description: "로그인이 필요하다", ...ERROR_BODY };
  }
  if (!isPublic && area !== "signedIn") {
    out[403] = { description: "이 자리를 열 권한이 없다", ...ERROR_BODY };
  }
  // 자리에 박힌 것을 가리켜 부르면 그것이 없을 수 있다. 한 건을 집어 오는 조회도
  // 같다 — 없는 것을 빈 값으로 대신하지 않는 것이 이 저장소의 규칙이다.
  const keyed = pathParams(path).length > 0 ||
    (shape === "object" && (params ?? []).some((param) => param.required));
  if (keyed) {
    out[404] = { description: "가리킨 것이 없다", ...ERROR_BODY };
  }
  if (repeatKind === "conflict") {
    out[409] = {
      description: "이미 그 상태다. 남이 먼저 했거나 두 번 눌렸다",
      ...ERROR_BODY
    };
  }
  if (hasBody) {
    out[422] = { description: "보낸 값이 받을 수 없는 것이다", ...ERROR_BODY };
  }
  // **열쇠가 주소에 실려 있다.** 로그인이 없으므로 토큰을 마구 넣어 보면 남의 것을
  // 열 수 있다 — 막지 않으면 그것이 유일한 벽이 된다.
  if (isPublic) {
    out[429] = { description: "너무 자주 눌렀다", ...ERROR_BODY };
  }
  return out;
}

/**
 * 보낸 뒤에 무엇이 오는가.
 *
 * 카탈로그가 `result`로 이미 말하고 있었는데 **여기로 이어진 적이 없었다** — 계약의
 * 성공 응답이 줄곧 빈 객체였다. 그래서 출석 확인이 영수증을 준다는 사실이 문서에
 * 없었고, 받는 쪽은 그것을 알 길이 없었다.
 */
function resultSchema(mutation) {
  const result = Array.isArray(mutation.result) ? mutation.result : [];
  if (result.length === 0) {
    return { type: "object", description: "보낸 뒤의 답. 이 자리는 돌려주는 값이 없다" };
  }
  const properties = {};
  for (const field of result) {
    properties[field.key] = { type: field.valueType, description: field.description };
  }
  return {
    type: "object",
    description: "보낸 뒤의 답",
    properties,
    required: result.map((field) => field.key)
  };
}

function responses(schema, failure = {}) {
  return {
    200: {
      description: "성공",
      content: { "application/json": { schema } }
    },
    ...failure,
    default: {
      description: "그 밖의 실패",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
    }
  };
}

/**
 * 두 번 보내진 것을 첫 번째와 같은 것으로 여기게 하는 열쇠.
 *
 * 자연 열쇠가 없는 자리에만 붙는다 — 같은 이름의 행사를 둘 만드는 것이 정당할 수
 * 있으므로 내용으로는 가릴 수 없고, 두 번 눌린 것과 두 번 의도한 것은 **보내는 쪽만**
 * 안다.
 */
function idempotencyHeader() {
  return {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    description:
      "보내는 쪽이 만드는 한 번뿐인 값. 같은 키로 다시 오면 서버는 새로 만들지 않고 첫 번째의 답을 그대로 준다.",
    schema: { type: "string" }
  };
}

export function buildOpenApi() {
  const dataSources = read("specs", "figma", "vada-wireframe", "data-sources.json");
  const mutations = read("specs", "figma", "vada-wireframe", "mutations.json");
  const optionSources = read("specs", "figma", "vada-wireframe", "option-sources.json");
  const byScope = fieldsByScope();

  const paths = {};
  const put = (path, method, operation) => {
    paths[path] = paths[path] ?? {};
    if (paths[path][method] !== undefined) {
      throw new Error(`같은 자리에 두 번 적었습니다: ${method.toUpperCase()} ${path}`);
    }
    // 밖에서 열리는 자리는 로그인이 없다. 비어 있는 security가 '이 자리는 뿌리의
    // 규칙을 따르지 않는다'는 뜻이다 — 안 적으면 뿌리의 세션이 걸린다.
    if (path.startsWith("/api/public/")) {
      operation.security = [];
    }
    paths[path][method] = operation;
  };

  for (const source of dataSources.sources ?? dataSources.dataSources) {
    const { method, path } = source.request;
    const item = objectSchema(source.fields ?? []);
    put(path, method.toLowerCase(), {
      operationId: source.key,
      summary: source.description,
      "x-authorize": authorizeOf(source),
      parameters: parametersOf(path, source.params),
      responses: responses(
        source.shape === "list" ? { type: "array", items: item } : item,
        failures({
          area: source.authorize?.area,
          path,
          params: source.params,
          shape: source.shape
        })
      )
    });
  }

  // 선택지 출처 중 서버에서 오는 것. 값과 글이 정규화되어 오므로 모양이 하나다.
  const option = {
    type: "object",
    properties: {
      value: { type: "string", description: "고른 값" },
      label: { type: "string", description: "그려지는 글" },
      description: { type: "string", description: "곁에 붙는 설명(선택)" },
      disabled: { type: "boolean", description: "고를 수 없는가(선택)" }
    },
    required: ["value", "label"]
  };
  for (const source of optionSources.sources) {
    if (source.request === undefined) continue;
    const { method, path } = source.request;
    const parameters = parametersOf(path, source.params);
    const queryParam = source.request.search?.queryParam;
    if (typeof queryParam === "string" && !parameters.some((p) => p.name === queryParam)) {
      parameters.push({
        name: queryParam,
        in: "query",
        required: false,
        schema: { type: "string" },
        description: `검색어. ${source.request.search.minLength ?? 0}자 이상`
      });
    }
    put(path, method.toLowerCase(), {
      // **이름이 겹친다.** org.departments가 데이터 카탈로그에도 있고 여기에도 있다 —
      // 조직도가 읽는 나무와 고르는 목록이라 다른 물건인데 이름이 같다. operationId는
      // 문서 전체에서 하나여야 하므로(코드 생성기가 함수 이름으로 쓴다) 여기에
      // 무엇의 목록인지를 붙인다.
      operationId: `${source.key}.options`,
      summary: source.description,
      "x-authorize": authorizeOf(source),
      parameters,
      responses: responses(
        { type: "array", items: option },
        failures({ area: source.authorize?.area, path, params: source.params, shape: "list" })
      )
    });
  }

  for (const mutation of mutations.mutations) {
    const { method, path } = mutation.request;
    const operation = {
      operationId: mutation.key,
      summary: mutation.description,
      "x-authorize": authorizeOf(mutation),
      parameters: [
        ...parametersOf(path, mutation.params),
        ...(mutation.repeat?.kind === "idempotencyKey" ? [idempotencyHeader()] : [])
      ],
      responses: responses(
        resultSchema(mutation),
        failures({
          area: mutation.authorize?.area,
          path,
          params: mutation.params,
          hasBody: typeof mutation.payloadScope === "string",
          repeatKind: mutation.repeat?.kind
        })
      )
    };
    if (typeof mutation.payloadScope === "string") {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": { schema: bodySchema(mutation.payloadScope, byScope) }
        }
      };
    }
    put(path, method.toLowerCase(), operation);
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "vada",
      version: "0.1.0",
      description:
        "학생회 운영 도구의 API. **이 문서는 손으로 쓰지 않는다** — " +
        "specs/figma/vada-wireframe의 카탈로그에서 만들어진다" +
        "(apps/spec-service/src/generate-openapi.mjs).\n\n" +
        "**아직 없는 것**: 인증 규약, 기계가 읽는 오류 코드, 쪽 나눔 규약. " +
        "명세가 정한 적이 없어 지어내지 않았다."
    },
    servers: [
      {
        url: "/",
        description:
          "**배포 주소는 아직 정하지 않았다.** 같은 호스트에서 잰다는 뜻으로 두었다 — " +
          "지어낸 도메인을 적으면 그 거짓이 생성된 클라이언트까지 간다."
      }
    ],
    // 사람이 정한 것: 소셜 로그인(구글·카카오)으로 들어오고 세션은 우리 Postgres에
    // 앉는다(docs/decisions/backend-architecture.md). 그 세션을 실어 나르는 것이
    // 쿠키다. **/api/public/*은 예외다** — 학생회 밖 사람이 QR과 링크로 여는 자리라
    // 로그인이 없고, 무엇을 볼 수 있는지는 주소가 실어 온 토큰이 정한다.
    security: [{ session: [] }],
    paths,
    components: {
      schemas: { Error: ERROR_SCHEMA },
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "cookie",
          name: "vada.session",
          description:
            "로그인한 사람의 세션. Better Auth가 발급하고 우리 Postgres에 앉는다."
        }
      }
    }
  };
}

const OUT = join(repoRoot, "specs", "figma", "vada-wireframe", "openapi.json");

if (process.argv[1] && process.argv[1].endsWith("generate-openapi.mjs")) {
  const document = buildOpenApi();
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`, "utf-8");
  const count = Object.values(document.paths).reduce(
    (sum, item) => sum + Object.keys(item).length,
    0
  );
  process.stdout.write(
    `openapi.json — 자리 ${Object.keys(document.paths).length}개 · 동작 ${count}개\n`
  );
}
