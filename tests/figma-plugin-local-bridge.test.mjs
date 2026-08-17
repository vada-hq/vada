import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  LOCAL_SPEC_SERVICE_ORIGIN,
  getLocalFigmaRawUrl,
  getLocalOptionSourcesUrl,
  getLocalScreenAssetUrl,
  getLocalScreenReferenceUrl,
  getLocalScreenSpecUrl,
  getLocalStateScopesUrl,
  loadOptionSourcesFromLocal,
  loadScreenSpecFromLocal,
  loadStateScopesFromLocal,
  saveFigmaAssetToLocal,
  saveFigmaRawToLocal,
  saveFigmaReferenceToLocal,
  saveScreenSpecToLocal
} from "../apps/figma-plugin/src/local-bridge.mjs";
import {
  DEFAULT_HOST,
  createSpecServer
} from "../apps/spec-service/src/server.mjs";

const manifestUrl = new URL(
  "../apps/figma-plugin/manifest.json",
  import.meta.url
);
const codeUrl = new URL(
  "../apps/figma-plugin/src/code.mjs",
  import.meta.url
);
const uiUrl = new URL(
  "../apps/figma-plugin/src/ui.mjs",
  import.meta.url
);

function createScreenSpec() {
  return {
    schemaVersion: 1,
    screenId: "ONB-02",
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

test("개발 플러그인은 loopback 브리지만 네트워크 접근을 허용한다", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.deepEqual(manifest.networkAccess, {
    allowedDomains: ["none"],
    devAllowedDomains: ["http://localhost:3846"]
  });
});

test("화면 저장 URL은 wireframeKey와 screenId를 경로로 사용한다", () => {
  assert.equal(LOCAL_SPEC_SERVICE_ORIGIN, "http://localhost:3846");
  assert.equal(
    getLocalScreenSpecUrl({
      wireframeKey: "vada-wireframe",
      screenId: "ONB-02"
    }),
    "http://localhost:3846/v1/screens/vada-wireframe/ONB-02"
  );
});

test("Figma 원본 저장 URL은 화면별 figma-raw 경로를 사용한다", () => {
  assert.equal(
    getLocalFigmaRawUrl({
      wireframeKey: "vada-wireframe",
      screenId: "ONB-02"
    }),
    "http://localhost:3846/v1/screens/vada-wireframe/ONB-02/figma-raw"
  );
});

test("Figma 원본 JSON 전체를 브리지 PUT API로 저장한다", async () => {
  const calls = [];
  const raw = createFigmaRaw();

  const result = await saveFigmaRawToLocal({
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        async json() {
          return {
            artifact: "figma.raw.json",
            screenId: "ONB-02",
            status: "saved",
            wireframeKey: "vada-wireframe"
          };
        }
      };
    },
    raw,
    screenId: "ONB-02",
    wireframeKey: "vada-wireframe"
  });

  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/screens/vada-wireframe/ONB-02/figma-raw",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: `${JSON.stringify(raw, null, 2)}\n`
      }
    ]
  ]);
  assert.deepEqual(result, {
    artifact: "figma.raw.json",
    screenId: "ONB-02",
    status: "saved",
    wireframeKey: "vada-wireframe"
  });
});

test("자산과 참조 이미지 URL은 화면별 하위 경로를 사용한다", () => {
  assert.equal(
    getLocalScreenAssetUrl({
      wireframeKey: "vada-wireframe",
      screenId: "ONB-01",
      fileName: "7-44.svg"
    }),
    "http://localhost:3846/v1/screens/vada-wireframe/ONB-01/assets/7-44.svg"
  );
  assert.equal(
    getLocalScreenReferenceUrl({
      wireframeKey: "vada-wireframe",
      screenId: "ONB-01"
    }),
    "http://localhost:3846/v1/screens/vada-wireframe/ONB-01/reference"
  );
});

test("벡터 SVG 자산을 브리지 PUT API로 저장한다", async () => {
  const calls = [];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';

  const result = await saveFigmaAssetToLocal({
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        async json() {
          return {
            artifact: "assets/7-44.svg",
            screenId: "ONB-01",
            status: "saved",
            wireframeKey: "vada-wireframe"
          };
        }
      };
    },
    fileName: "7-44.svg",
    screenId: "ONB-01",
    svg,
    wireframeKey: "vada-wireframe"
  });

  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/screens/vada-wireframe/ONB-01/assets/7-44.svg",
      {
        method: "PUT",
        headers: { "Content-Type": "image/svg+xml" },
        body: svg
      }
    ]
  ]);
  assert.equal(result.artifact, "assets/7-44.svg");

  await assert.rejects(
    saveFigmaAssetToLocal({
      fetchImpl: async () => {
        throw new Error("호출되면 안 됩니다.");
      },
      fileName: "7-44.svg",
      screenId: "ONB-01",
      svg: "not svg",
      wireframeKey: "vada-wireframe"
    }),
    /SVG 본문/
  );
});

test("화면 참조 PNG를 브리지 PUT API로 저장한다", async () => {
  const calls = [];
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  const result = await saveFigmaReferenceToLocal({
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        async json() {
          return {
            artifact: "reference.png",
            screenId: "ONB-01",
            status: "saved",
            wireframeKey: "vada-wireframe"
          };
        }
      };
    },
    png,
    screenId: "ONB-01",
    wireframeKey: "vada-wireframe"
  });

  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/screens/vada-wireframe/ONB-01/reference",
      {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: png
      }
    ]
  ]);
  assert.equal(result.artifact, "reference.png");

  await assert.rejects(
    saveFigmaReferenceToLocal({
      fetchImpl: async () => {
        throw new Error("호출되면 안 됩니다.");
      },
      png: new Uint8Array(),
      screenId: "ONB-01",
      wireframeKey: "vada-wireframe"
    }),
    /참조 PNG/
  );
});

test("옵션 출처 카탈로그 URL은 wireframeKey를 경로로 사용한다", () => {
  assert.equal(
    getLocalOptionSourcesUrl({ wireframeKey: "vada-wireframe" }),
    "http://localhost:3846/v1/option-sources/vada-wireframe"
  );
});

test("상태 스코프 카탈로그 URL은 wireframeKey를 경로로 사용한다", () => {
  assert.equal(
    getLocalStateScopesUrl({ wireframeKey: "vada-wireframe" }),
    "http://localhost:3846/v1/state-scopes/vada-wireframe"
  );
});

test("wireframe 상태 스코프 카탈로그를 브리지 GET API로 불러온다", async () => {
  const calls = [];
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

  assert.deepEqual(
    await loadStateScopesFromLocal({
      fetchImpl: async (...args) => {
        calls.push(args);
        return {
          ok: true,
          status: 200,
          async json() {
            return catalog;
          }
        };
      },
      wireframeKey: "vada-wireframe"
    }),
    catalog
  );
  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/state-scopes/vada-wireframe",
      { method: "GET" }
    ]
  ]);
});

test("wireframe 옵션 출처 카탈로그를 브리지 GET API로 불러온다", async () => {
  const calls = [];
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

  assert.deepEqual(
    await loadOptionSourcesFromLocal({
      fetchImpl: async (...args) => {
        calls.push(args);
        return {
          ok: true,
          status: 200,
          async json() {
            return catalog;
          }
        };
      },
      wireframeKey: "vada-wireframe"
    }),
    catalog
  );
  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/option-sources/vada-wireframe",
      { method: "GET" }
    ]
  ]);
});

test("화면 JSON 전체를 브리지 PUT API로 저장한다", async () => {
  const calls = [];
  const screenSpec = createScreenSpec();
  const fetchImpl = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      headers: {
        get(name) {
          return name.toLowerCase() === "etag"
            ? '"revision-1"'
            : null;
        }
      },
      async json() {
        return {
          screenId: "ONB-02",
          status: "saved",
          wireframeKey: "vada-wireframe"
        };
      }
    };
  };

  const result = await saveScreenSpecToLocal({
    fetchImpl,
    expectedRevision: null,
    screenSpec,
    wireframeKey: "vada-wireframe"
  });

  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/screens/vada-wireframe/ONB-02",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-None-Match": "*"
        },
        body: `${JSON.stringify(screenSpec, null, 2)}\n`
      }
    ]
  ]);
  assert.deepEqual(result, {
    screenId: "ONB-02",
    status: "saved",
    wireframeKey: "vada-wireframe",
    revision: '"revision-1"'
  });
});

test("로컬 화면 JSON과 리비전을 GET으로 불러온다", async () => {
  const calls = [];
  const screenSpec = createScreenSpec();
  const fetchImpl = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name.toLowerCase() === "etag"
            ? '"revision-1"'
            : null;
        }
      },
      async json() {
        return screenSpec;
      }
    };
  };

  assert.deepEqual(
    await loadScreenSpecFromLocal({
      fetchImpl,
      screenId: "ONB-02",
      wireframeKey: "vada-wireframe"
    }),
    {
      screenSpec,
      revision: '"revision-1"',
      status: "loaded"
    }
  );
  assert.deepEqual(calls, [
    [
      "http://localhost:3846/v1/screens/vada-wireframe/ONB-02",
      { method: "GET" }
    ]
  ]);
});

test("로컬 화면 JSON이 없으면 새 파일 기준을 반환한다", async () => {
  assert.deepEqual(
    await loadScreenSpecFromLocal({
      fetchImpl: async () => ({ ok: false, status: 404 }),
      screenId: "ONB-02",
      wireframeKey: "vada-wireframe"
    }),
    { screenSpec: null, revision: null, status: "missing" }
  );
});

test("기존 리비전 저장에는 If-Match를 전송한다", async () => {
  const calls = [];

  await saveScreenSpecToLocal({
    expectedRevision: '"revision-1"',
    fetchImpl: async (...args) => {
      calls.push(args);
      return {
        ok: true,
        headers: { get: () => '"revision-2"' },
        async json() {
          return { status: "saved" };
        }
      };
    },
    screenSpec: createScreenSpec(),
    wireframeKey: "vada-wireframe"
  });

  assert.equal(calls[0][1].headers["If-Match"], '"revision-1"');
  assert.equal(calls[0][1].headers["If-None-Match"], undefined);
});

test("브리지 연결 실패와 HTTP 오류를 사용자가 이해할 수 있게 변환한다", async () => {
  const screenSpec = createScreenSpec();

  await assert.rejects(
    saveScreenSpecToLocal({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
      screenSpec,
      wireframeKey: "vada-wireframe"
    }),
    /로컬 브리지에 연결할 수 없습니다/
  );

  await assert.rejects(
    saveScreenSpecToLocal({
      fetchImpl: async () => ({
        ok: false,
        status: 400,
        async json() {
          return {
            error: {
              code: "screen_id_mismatch",
              message: "screenId가 일치하지 않습니다."
            }
          };
        }
      }),
      screenSpec,
      wireframeKey: "vada-wireframe"
    }),
    /screenId가 일치하지 않습니다/
  );

  await assert.rejects(
    saveScreenSpecToLocal({
      expectedRevision: '"stale"',
      fetchImpl: async () => ({
        ok: false,
        status: 412,
        async json() {
          return {
            error: {
              code: "revision_conflict",
              message: "로컬 JSON이 변경되었습니다. 최신 초안을 다시 불러오세요."
            }
          };
        }
      }),
      screenSpec,
      wireframeKey: "vada-wireframe"
    }),
    /최신 초안을 다시 불러오세요/
  );
});

test("wireframeKey 또는 screenId가 없으면 네트워크 요청 전에 거부한다", async () => {
  let called = false;

  await assert.rejects(
    saveScreenSpecToLocal({
      fetchImpl: async () => {
        called = true;
      },
      screenSpec: createScreenSpec(),
      wireframeKey: ""
    }),
    /wireframeKey/
  );
  assert.equal(called, false);
});

test("Figma 내부 저장 뒤 다운로드 대신 로컬 브리지 저장을 실행한다", async () => {
  const [codeSource, uiSource] = await Promise.all([
    readFile(codeUrl, "utf8"),
    readFile(uiUrl, "utf8")
  ]);

  assert.match(
    codeSource,
    /wireframeKey:\s*screenContext\.wireframeKey/
  );
  assert.match(uiSource, /await saveScreenSpecToLocal\(/);
  assert.doesNotMatch(uiSource, /function downloadScreenSpec\(/);
});

test("플러그인 저장 요청이 실제 브리지를 거쳐 정식 구조의 파일을 만든다", async (t) => {
  const specsRoot = await mkdtemp(join(tmpdir(), "figma-plugin-bridge-"));
  const server = createSpecServer({ specsRoot });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, DEFAULT_HOST, resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(specsRoot, { recursive: true, force: true });
  });

  const address = server.address();
  const screenSpec = createScreenSpec();

  await saveScreenSpecToLocal({
    expectedRevision: null,
    origin: `http://${address.address}:${address.port}`,
    screenSpec,
    wireframeKey: "vada-wireframe"
  });

  assert.deepEqual(
    JSON.parse(
      await readFile(
        join(
          specsRoot,
          "vada-wireframe",
          "screens",
          "ONB-02.json"
        ),
        "utf8"
      )
    ),
    screenSpec
  );
});

test("자산 저장 요청이 실제 브리지를 거쳐 SVG와 reference.png 파일을 만든다", async (t) => {
  const specsRoot = await mkdtemp(join(tmpdir(), "figma-plugin-assets-"));
  const server = createSpecServer({ specsRoot });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, DEFAULT_HOST, resolve);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await rm(specsRoot, { recursive: true, force: true });
  });

  const address = server.address();
  const origin = `http://${address.address}:${address.port}`;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14"/>';
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02
  ]);

  await saveFigmaAssetToLocal({
    fileName: "7-44.svg",
    origin,
    screenId: "ONB-01",
    svg,
    wireframeKey: "vada-wireframe"
  });
  await saveFigmaReferenceToLocal({
    origin,
    png,
    screenId: "ONB-01",
    wireframeKey: "vada-wireframe"
  });

  const screenDir = join(specsRoot, "vada-wireframe", "screens", "ONB-01");
  assert.equal(await readFile(join(screenDir, "assets", "7-44.svg"), "utf8"), svg);
  assert.deepEqual(
    new Uint8Array(await readFile(join(screenDir, "reference.png"))),
    png
  );
});

test("플러그인 UI는 로컬 변경 감지와 명시적 불러오기를 제공한다", async () => {
  const [codeSource, uiSource, uiHtml] = await Promise.all([
    readFile(codeUrl, "utf8"),
    readFile(uiUrl, "utf8"),
    readFile(
      new URL("../apps/figma-plugin/src/ui.html", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(uiHtml, /id="load-local-screen"/);
  assert.match(uiSource, /await loadScreenSpecFromLocal\(/);
  assert.match(uiSource, /type:\s*"prepare-local-screen-spec"/);
  assert.match(codeSource, /message\?\.type === "prepare-local-screen-spec"/);
});

test("플러그인 UI는 카탈로그 계약과 구현 준비 상태를 전용 편집기로 표시한다", async () => {
  const [uiSource, uiHtml] = await Promise.all([
    readFile(uiUrl, "utf8"),
    readFile(
      new URL("../apps/figma-plugin/src/ui.html", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(uiSource, /await loadOptionSourcesFromLocal\(/);
  assert.match(uiSource, /function createOptionsSourcePropertyItem\(/);
  assert.match(uiSource, /function appendRemoteOptionSourceDetails\(/);
  assert.match(uiSource, /getOptionSourceReadiness\(/);
  assert.match(uiSource, /"response\.options\[\]\.value"/);
  assert.match(uiSource, /"response\.options\[\]\.label"/);
  assert.match(uiSource, /"response\.options\[\]\.disabled"/);
  assert.match(uiSource, /"search\.mode"/);
  assert.match(uiSource, /"search\.queryParam"/);
  assert.match(uiSource, /"search\.minLength"/);
  assert.match(uiSource, /"search\.debounceMs"/);
  assert.match(uiSource, /function createStaticOptionSourceDetails\(/);
  assert.match(uiSource, /STATIC_OPTION_SEARCH_THRESHOLD = 20/);
  assert.match(uiSource, /filterOptionSourceOptions\(/);
  assert.match(uiSource, /option-source-option-disabled/);
  assert.match(uiHtml, /\.option-source-option-list/);
  assert.match(uiHtml, /max-height:\s*240px/);
  assert.match(uiSource, /option-source-readiness/);
  assert.match(uiSource, /option-source-type/);
  assert.match(uiSource, /optionsSource\.params/);
});
