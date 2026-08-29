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

function parametersOf(path, declared) {
  const inPath = new Set(pathParams(path));
  const out = [];
  for (const name of inPath) {
    out.push({
      name,
      in: "path",
      required: true,
      schema: { type: "string" }
    });
  }
  for (const name of declared ?? []) {
    if (inPath.has(name)) continue;
    // 조회 인자는 없어도 된다 — 거르지 않으면 전부를 준다는 것이 이 저장소의
    // 규칙이고, 개발용 응답이 그렇게 답한다.
    out.push({ name, in: "query", required: false, schema: { type: "string" } });
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
    "**아직 정하지 않았다.** 카탈로그는 실패했을 때 사람에게 보일 글(messages.error)만 " +
    "갖고 있고, 기계가 읽을 코드는 정한 적이 없다. 지어내지 않고 자리만 둔다.",
  properties: {
    message: { type: "string", description: "사람에게 보일 글" }
  },
  required: ["message"]
};

function responses(schema) {
  return {
    200: {
      description: "성공",
      content: { "application/json": { schema } }
    },
    default: {
      description: "실패",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } }
    }
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
      parameters: parametersOf(path, source.params),
      responses: responses(source.shape === "list" ? { type: "array", items: item } : item)
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
      parameters,
      responses: responses({ type: "array", items: option })
    });
  }

  for (const mutation of mutations.mutations) {
    const { method, path } = mutation.request;
    const operation = {
      operationId: mutation.key,
      summary: mutation.description,
      parameters: parametersOf(path, mutation.params),
      responses: responses({ type: "object", description: "보낸 뒤의 답" })
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
