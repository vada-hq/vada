import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadFigmaDesignFromLocal,
  loadPrecedentScreensFromLocal
} from "../apps/figma-plugin/src/local-bridge.mjs";

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

// 2026-08-19 결정: 플러그인은 명세를 쓰지 않는다. 값을 정하는 일은 AI가 하고
// 사람은 확인만 한다. 편집이 없으면 "명세를 폼으로 펼쳤다가 다시 직렬화하는"
// 왕복이 없고, 그 왕복에서만 생기던 결함 계급도 함께 사라진다.
test("플러그인은 화면 JSON을 쓰지 않는다", async () => {
  const [codeSource, uiSource, bridgeSource] = await Promise.all([
    readFile(codeUrl, "utf8"),
    readFile(uiUrl, "utf8"),
    readFile(
      new URL("../apps/figma-plugin/src/local-bridge.mjs", import.meta.url),
      "utf8"
    )
  ]);

  assert.doesNotMatch(
    bridgeSource,
    /saveScreenSpecToLocal/u,
    "브리지 클라이언트에 화면 JSON 저장 함수가 남아 있습니다."
  );
  for (const [source, name] of [
    [uiSource, "ui.mjs"],
    [codeSource, "code.mjs"]
  ]) {
    assert.doesNotMatch(
      source,
      /save-screen-spec|prepare-local-screen-spec/u,
      `${name}에 명세 저장·가져오기 메시지가 남아 있습니다.`
    );
  }
});

test("플러그인은 Figma 문서에 명세 사본을 두지 않는다", async () => {
  const codeSource = await readFile(codeUrl, "utf8");

  // 화면 신원(screen-context)은 Figma에 남지만 명세(screen-spec)는 남지 않는다.
  // 사본이 있으면 로컬 JSON과 어긋날 수 있고, 그걸 맞추는 동기화 의식이
  // 영구히 따라붙는다.
  assert.doesNotMatch(codeSource, /screen-spec\.mjs|restoreScreenSpec/u);
  assert.match(codeSource, /restoreScreenContext/u);
});

test("플러그인 UI는 명세를 브리지에서 읽어 읽기 전용으로 표시한다", async () => {
  const [uiSource, uiHtml] = await Promise.all([
    readFile(uiUrl, "utf8"),
    readFile(
      new URL("../apps/figma-plugin/src/ui.html", import.meta.url),
      "utf8"
    )
  ]);

  assert.match(uiSource, /await loadScreenSpecFromLocal\(/u);
  assert.match(uiHtml, /id="screen-spec-elements"/u);
  assert.match(uiHtml, /id="refresh-screen-spec"/u);

  // 입력 위젯이 남아 있으면 읽기 전용이 아니다.
  assert.doesNotMatch(uiSource, /createElement\("input"\)/u);
  assert.doesNotMatch(uiSource, /createElement\("select"\)/u);
});

test("플러그인 UI는 선택지 출처를 카탈로그에서 찾아 함께 보여준다", async () => {
  const uiSource = await readFile(uiUrl, "utf8");

  // 선택지 내용은 카탈로그가 원본이라 화면 JSON만 봐서는 확인할 수 없다.
  assert.match(uiSource, /await loadOptionSourcesFromLocal\(/u);
  assert.match(uiSource, /findOptionSourceByKey\(/u);
  assert.match(uiSource, /카탈로그에/u);
});

// 고정폭 스택을 명시하지 않으면 브라우저 기본 monospace로 떨어져 본문과
// 눈에 띄게 다른 폰트가 섞인다(ui.html을 다시 쓰다가 실제로 빠뜨렸다).
test("플러그인 UI는 식별자용 고정폭 폰트를 명시한다", async () => {
  const uiHtml = await readFile(
    new URL("../apps/figma-plugin/src/ui.html", import.meta.url),
    "utf8"
  );

  assert.match(uiHtml, /code \{\s*font-family:[^;]*monospace;/u);

  // 한글이 들어가는 값은 고정폭으로 그리지 않는다. Consolas에 한글 글리프가
  // 없어 시스템 한글 폰트로 갈라지기 때문이다.
  assert.doesNotMatch(uiHtml, /<code id="node-name">/u);
});

// 근거 표시가 쓰는 읽기. 부가 정보이므로 실패해도 명세 표시를 막지 않는다.
test("정규화된 design이 없으면 근거 계산을 포기하고 null을 준다", async () => {
  const design = await loadFigmaDesignFromLocal({
    wireframeKey: "vada-wireframe",
    screenId: "ONB-01",
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) })
  });

  assert.equal(design, null);
});

test("브리지에 닿지 못해도 던지지 않는다", async () => {
  const screens = await loadPrecedentScreensFromLocal({
    wireframeKey: "vada-wireframe",
    exceptScreenId: "ONB-01",
    fetchImpl: async () => {
      throw new Error("연결 실패");
    }
  });

  assert.deepEqual(screens, []);
});

// 자기 자신을 선례로 삼으면 모든 값이 precedent로 보여 확인 대상이 사라진다.
test("선례를 모을 때 대상 화면 자신은 뺀다", async () => {
  const asked = [];
  const screens = await loadPrecedentScreensFromLocal({
    wireframeKey: "vada-wireframe",
    exceptScreenId: "INV-01",
    fetchImpl: async (url) => {
      asked.push(url);
      if (url.endsWith("/v1/screens/vada-wireframe")) {
        return {
          ok: true,
          json: async () => ({ screenIds: ["INV-01", "ONB-01"] })
        };
      }
      return { ok: true, json: async () => ({ screenId: "ONB-01" }) };
    }
  });

  assert.deepEqual(screens, [{ screenId: "ONB-01" }]);
  assert.equal(
    asked.some((url) => url.includes("/INV-01")),
    false
  );
});
