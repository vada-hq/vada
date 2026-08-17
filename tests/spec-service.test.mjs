import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DEFAULT_HOST,
  createSpecServer
} from "../apps/spec-service/src/server.mjs";

async function startServer(t) {
  const specsRoot = await mkdtemp(join(tmpdir(), "figma-spec-service-"));
  const server = createSpecServer({ specsRoot });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, DEFAULT_HOST, resolve);
  });

  const address = server.address();
  const baseUrl = `http://${address.address}:${address.port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(specsRoot, { recursive: true, force: true });
  });

  return { baseUrl, specsRoot };
}

function createScreenSpec(screenId = "ONB-02") {
  return {
    schemaVersion: 1,
    screenId,
    source: {
      pageName: "Wireframe",
      nodeId: "10:2",
      name: "온보딩 · ONB-02 · 시작 방식 선택",
      figmaType: "FRAME"
    },
    elements: []
  };
}

function createFigmaRaw() {
  return {
    document: {
      id: "10:2",
      name: "온보딩 · ONB-02 · 시작 방식 선택",
      type: "FRAME",
      children: []
    },
    components: {},
    componentSets: {},
    schemaVersion: 0,
    styles: {}
  };
}

test("상태 확인은 loopback 브리지의 준비 상태를 반환한다", async (t) => {
  assert.equal(DEFAULT_HOST, "127.0.0.1");

  const { baseUrl } = await startServer(t);
  const response = await fetch(`${baseUrl}/health`);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("화면 JSON을 정식 경로에 원자적으로 저장하고 다시 조회한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const screenSpec = createScreenSpec();
  const screenUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-02`;

  const putResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "if-none-match": "*"
    },
    body: JSON.stringify(screenSpec)
  });

  assert.equal(putResponse.status, 200);
  const firstRevision = putResponse.headers.get("etag");
  assert.match(firstRevision, /^"[0-9a-f]{64}"$/);
  assert.deepEqual(await putResponse.json(), {
    screenId: "ONB-02",
    status: "saved",
    wireframeKey: "vada-wireframe"
  });

  const filePath = join(
    specsRoot,
    "vada-wireframe",
    "screens",
    "ONB-02",
    "screen.json"
  );
  const fileContents = await readFile(filePath, "utf8");
  assert.equal(fileContents.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(fileContents), screenSpec);
  assert.deepEqual(
    await readdir(join(specsRoot, "vada-wireframe", "screens")),
    ["ONB-02"]
  );

  const updatedScreenSpec = {
    ...screenSpec,
    elements: [
      {
        source: {
          nodeId: "14:111",
          name: "Button",
          figmaType: "FRAME"
        },
        spec: {
          type: "button",
          label: "새 학생회 만들기",
          initiallyDisabled: false,
          action: {
            type: "navigate",
            targetScreenId: "ORG-01"
          }
        }
      }
    ]
  };
  const overwriteResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "if-match": firstRevision
    },
    body: JSON.stringify(updatedScreenSpec)
  });
  assert.equal(overwriteResponse.status, 200);
  const updatedRevision = overwriteResponse.headers.get("etag");
  assert.match(updatedRevision, /^"[0-9a-f]{64}"$/);
  assert.notEqual(updatedRevision, firstRevision);
  assert.deepEqual(
    JSON.parse(await readFile(filePath, "utf8")),
    updatedScreenSpec
  );
  assert.deepEqual(
    await readdir(join(specsRoot, "vada-wireframe", "screens")),
    ["ONB-02"]
  );

  const getResponse = await fetch(screenUrl);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.headers.get("etag"), updatedRevision);
  assert.deepEqual(await getResponse.json(), updatedScreenSpec);
});

test("Figma 원본 JSON을 화면별 figma.raw.json으로 저장한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const raw = createFigmaRaw();
  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-02/figma-raw`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw)
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    artifact: "figma.raw.json",
    screenId: "ONB-02",
    status: "saved",
    wireframeKey: "vada-wireframe"
  });

  const filePath = join(
    specsRoot,
    "vada-wireframe",
    "screens",
    "ONB-02",
    "figma.raw.json"
  );
  const fileContents = await readFile(filePath, "utf8");
  assert.equal(fileContents.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(fileContents), raw);
});

test("벡터 SVG 자산을 화면별 assets 폴더에 저장한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14"><path d="M1 1h12"/></svg>';

  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-01/assets/7-44.svg`,
    {
      method: "PUT",
      headers: { "content-type": "image/svg+xml" },
      body: svg
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    artifact: "assets/7-44.svg",
    screenId: "ONB-01",
    status: "saved",
    wireframeKey: "vada-wireframe"
  });

  const filePath = join(
    specsRoot,
    "vada-wireframe",
    "screens",
    "ONB-01",
    "assets",
    "7-44.svg"
  );
  assert.equal(await readFile(filePath, "utf8"), svg);
});

test("화면 참조 PNG를 화면 폴더의 reference.png로 저장한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("fake-image-data")
  ]);

  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-01/reference`,
    {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: png
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    artifact: "reference.png",
    screenId: "ONB-01",
    status: "saved",
    wireframeKey: "vada-wireframe"
  });

  const saved = await readFile(
    join(specsRoot, "vada-wireframe", "screens", "ONB-01", "reference.png")
  );
  assert.deepEqual(saved, png);
});

test("자산 파일 이름과 본문 형식을 검증하고 잘못된 요청을 거부한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  const assetUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-01/assets/7-44.svg`;

  const badNameResponse = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-01/assets/..%2Fescape.svg`,
    {
      method: "PUT",
      headers: { "content-type": "image/svg+xml" },
      body: svg
    }
  );
  assert.equal(badNameResponse.status, 400);

  const badExtensionResponse = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-01/assets/logo.png`,
    {
      method: "PUT",
      headers: { "content-type": "image/svg+xml" },
      body: svg
    }
  );
  assert.equal(badExtensionResponse.status, 400);

  const badTypeResponse = await fetch(assetUrl, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: svg
  });
  assert.equal(badTypeResponse.status, 415);

  const badBodyResponse = await fetch(assetUrl, {
    method: "PUT",
    headers: { "content-type": "image/svg+xml" },
    body: "not svg"
  });
  assert.equal(badBodyResponse.status, 400);

  const badPngResponse = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-01/reference`,
    {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: Buffer.from("not png")
    }
  );
  assert.equal(badPngResponse.status, 400);

  const getAssetResponse = await fetch(assetUrl);
  assert.equal(getAssetResponse.status, 405);
  assert.equal(getAssetResponse.headers.get("allow"), "PUT, OPTIONS");

  assert.deepEqual(await readdir(specsRoot), []);
});

test("오래된 리비전으로 로컬 JSON을 덮어쓰지 못한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const screenUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-02`;
  const screenSpec = createScreenSpec();

  const firstResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "if-none-match": "*"
    },
    body: JSON.stringify(screenSpec)
  });
  assert.equal(firstResponse.status, 200);

  const conflictingSpec = {
    ...screenSpec,
    elements: [{ source: { nodeId: "14:111" }, spec: { type: "button" } }]
  };
  const conflictResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "if-match": '"stale-revision"'
    },
    body: JSON.stringify(conflictingSpec)
  });

  assert.equal(conflictResponse.status, 412);
  assert.deepEqual(await conflictResponse.json(), {
    error: {
      code: "revision_conflict",
      message: "로컬 JSON이 변경되었습니다. 최신 초안을 다시 불러오세요."
    }
  });
  assert.deepEqual(
    JSON.parse(
      await readFile(
        join(specsRoot, "vada-wireframe", "screens", "ONB-02", "screen.json"),
        "utf8"
      )
    ),
    screenSpec
  );
});

test("없는 화면은 404를 반환한다", async (t) => {
  const { baseUrl } = await startServer(t);
  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/UNKNOWN`
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: {
      code: "screen_not_found",
      message: "저장된 화면 JSON을 찾을 수 없습니다."
    }
  });
});

test("wireframe 옵션 출처 카탈로그를 정식 경로에서 조회한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const catalog = {
    schemaVersion: 2,
    sources: [
      {
        key: "example.values",
        type: "static",
        description: "예시 선택지",
        params: [],
        options: [{ value: "value", label: "값" }]
      }
    ]
  };
  const directory = join(specsRoot, "vada-wireframe");

  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "option-sources.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8"
  );

  const response = await fetch(
    `${baseUrl}/v1/option-sources/vada-wireframe`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), catalog);
});

test("wireframe 상태 스코프 카탈로그를 정식 경로에서 조회한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const catalog = {
    schemaVersion: 1,
    scopes: [
      {
        key: "onboardingDraft",
        description: "온보딩 입력 초안",
        lifetime: "flow",
        clearOn: ["complete", "cancel"]
      }
    ]
  };
  const directory = join(specsRoot, "vada-wireframe");

  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "state-scopes.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8"
  );

  const response = await fetch(
    `${baseUrl}/v1/state-scopes/vada-wireframe`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), catalog);
});

test("경로로 사용할 수 없는 식별자는 파일 접근 전에 거부한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const response = await fetch(
    `${baseUrl}/v1/screens/bad%2Fkey/ONB-02`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createScreenSpec())
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readdir(specsRoot), []);
});

test("URL과 JSON의 screenId가 다르면 저장하지 않는다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-02`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createScreenSpec("ONB-03"))
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await readdir(specsRoot), []);
});

test("잘못된 JSON과 지원하지 않는 content-type을 거부한다", async (t) => {
  const { baseUrl } = await startServer(t);
  const screenUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-02`;

  const invalidJsonResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{"
  });
  assert.equal(invalidJsonResponse.status, 400);

  const invalidTypeResponse = await fetch(screenUrl, {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(createScreenSpec())
  });
  assert.equal(invalidTypeResponse.status, 415);
});

test("Figma 플러그인용 CORS preflight를 처리한다", async (t) => {
  const { baseUrl } = await startServer(t);
  const response = await fetch(
    `${baseUrl}/v1/screens/vada-wireframe/ONB-02`,
    {
      method: "OPTIONS",
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "PUT",
        origin: "null"
      }
    }
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "null");
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, PUT, OPTIONS");
  assert.equal(
    response.headers.get("access-control-allow-headers"),
    "Content-Type, If-Match, If-None-Match"
  );
  assert.equal(response.headers.get("access-control-expose-headers"), "ETag");
});

test("허용되지 않은 웹 Origin의 요청은 쓰기 전에 거부한다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const screenUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-02`;

  const preflight = await fetch(screenUrl, {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "PUT"
    }
  });
  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);

  const blockedPut = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      "if-none-match": "*"
    },
    body: JSON.stringify(createScreenSpec())
  });
  assert.equal(blockedPut.status, 403);
  const blockedBody = await blockedPut.json();
  assert.equal(blockedBody.error.code, "forbidden_origin");
  assert.deepEqual(await readdir(specsRoot), []);

  const pluginPut = await fetch(screenUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "null",
      "if-none-match": "*"
    },
    body: JSON.stringify(createScreenSpec())
  });
  assert.equal(pluginPut.status, 200);
  assert.equal(pluginPut.headers.get("access-control-allow-origin"), "null");

  const figmaHealth = await fetch(`${baseUrl}/health`, {
    headers: { origin: "https://www.figma.com" }
  });
  assert.equal(figmaHealth.status, 200);
  assert.equal(
    figmaHealth.headers.get("access-control-allow-origin"),
    "https://www.figma.com"
  );
});

test("화면 폴더의 Figma 노드 신원이 다르면 원본 번들을 덮어쓰지 않는다", async (t) => {
  const { baseUrl, specsRoot } = await startServer(t);
  const rawUrl = `${baseUrl}/v1/screens/vada-wireframe/ONB-02/figma-raw`;
  const json = { "Content-Type": "application/json" };

  const first = await fetch(rawUrl, {
    method: "PUT",
    headers: json,
    body: JSON.stringify(createFigmaRaw())
  });
  assert.equal(first.status, 200);

  // 같은 화면 재저장(디자인 수정 후 다시 뽑기)은 정상 동작이다.
  const again = await fetch(rawUrl, {
    method: "PUT",
    headers: json,
    body: JSON.stringify(createFigmaRaw())
  });
  assert.equal(again.status, 200, "같은 노드의 재저장은 허용해야 한다");

  // screenId를 잘못 지정한 채 다른 프레임을 저장하면 차단한다.
  const mismatched = await fetch(rawUrl, {
    method: "PUT",
    headers: json,
    body: JSON.stringify({ document: { id: "9:9", name: "다른 화면" } })
  });
  assert.equal(mismatched.status, 409);
  assert.equal((await mismatched.json()).error.code, "screen_identity_mismatch");

  const stored = JSON.parse(
    await readFile(
      join(specsRoot, "vada-wireframe", "screens", "ONB-02", "figma.raw.json"),
      "utf8"
    )
  );
  assert.equal(stored.document.id, "10:2", "기존 원본이 보존되어야 한다");
});

test("화면 JSON도 폴더 신원이 다른 노드로 덮어쓰지 못한다", async (t) => {
  const { baseUrl } = await startServer(t);
  const url = `${baseUrl}/v1/screens/vada-wireframe/ONB-02`;
  const json = { "Content-Type": "application/json" };

  const first = await fetch(url, {
    method: "PUT",
    headers: json,
    body: JSON.stringify(createScreenSpec())
  });
  assert.equal(first.status, 200);

  const mismatched = await fetch(url, {
    method: "PUT",
    headers: { ...json, "If-Match": first.headers.get("etag") },
    body: JSON.stringify({
      ...createScreenSpec(),
      source: { ...createScreenSpec().source, nodeId: "9:9" }
    })
  });
  assert.equal(mismatched.status, 409);
  assert.equal((await mismatched.json()).error.code, "screen_identity_mismatch");
});
