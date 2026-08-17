import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  REFERENCE_PNG_SCALE,
  exportFigmaRaw,
  exportFigmaScreenAssets
} from "../apps/figma-plugin/src/figma-raw.mjs";

const codeUrl = new URL("../apps/figma-plugin/src/code.mjs", import.meta.url);
const uiUrl = new URL("../apps/figma-plugin/src/ui.mjs", import.meta.url);
const uiHtmlUrl = new URL(
  "../apps/figma-plugin/src/ui.html",
  import.meta.url
);

test("작업 화면을 Figma REST 원본 JSON 형식으로 추출한다", async () => {
  const calls = [];
  const raw = {
    document: {
      id: "10:2",
      name: "온보딩 · ONB-02 · 시작 방식 선택",
      type: "FRAME"
    }
  };
  const screenNode = {
    async exportAsync(settings) {
      calls.push(settings);
      return raw;
    }
  };

  assert.equal(await exportFigmaRaw(screenNode), raw);
  assert.deepEqual(calls, [{ format: "JSON_REST_V1" }]);
});

test("Figma 원본 응답에 document 객체가 없으면 거부한다", async () => {
  await assert.rejects(
    exportFigmaRaw({
      async exportAsync() {
        return { document: null };
      }
    }),
    /document/
  );
});

test("화면의 벡터 SVG와 참조 PNG를 함께 추출한다", async () => {
  const exportCalls = [];
  const createVectorNode = (id, type) => ({
    id,
    type,
    async exportAsync(settings) {
      exportCalls.push([id, settings]);
      return `<svg data-node="${id}"></svg>`;
    }
  });
  const nodes = [
    createVectorNode("7:44", "VECTOR"),
    { id: "7:9", type: "TEXT" },
    createVectorNode("7:90", "BOOLEAN_OPERATION")
  ];
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const screenNode = {
    findAll: (predicate) => nodes.filter(predicate),
    async exportAsync(settings) {
      exportCalls.push(["screen", settings]);
      return pngBytes;
    }
  };

  const result = await exportFigmaScreenAssets(screenNode);

  assert.deepEqual(result.assets, [
    {
      nodeId: "7:44",
      fileName: "7-44.svg",
      svg: '<svg data-node="7:44"></svg>'
    },
    {
      nodeId: "7:90",
      fileName: "7-90.svg",
      svg: '<svg data-node="7:90"></svg>'
    }
  ]);
  assert.equal(result.referencePng, pngBytes);
  assert.equal(REFERENCE_PNG_SCALE, 2);
  assert.deepEqual(exportCalls, [
    ["7:44", { format: "SVG_STRING" }],
    ["7:90", { format: "SVG_STRING" }],
    ["screen", { format: "PNG", constraint: { type: "SCALE", value: 2 } }]
  ]);
});

test("SVG나 참조 PNG 추출이 실패하면 명확히 거부한다", async () => {
  const brokenSvgScreen = {
    findAll: () => [
      {
        id: "7:44",
        type: "VECTOR",
        async exportAsync() {
          return "";
        }
      }
    ],
    async exportAsync() {
      return new Uint8Array([1]);
    }
  };
  await assert.rejects(exportFigmaScreenAssets(brokenSvgScreen), /SVG/);

  const brokenPngScreen = {
    findAll: () => [],
    async exportAsync() {
      return null;
    }
  };
  await assert.rejects(exportFigmaScreenAssets(brokenPngScreen), /PNG/);
});

test("원본 저장 시 벡터 SVG와 참조 PNG도 함께 로컬로 저장한다", async () => {
  const [codeSource, uiSource] = await Promise.all([
    readFile(codeUrl, "utf8"),
    readFile(uiUrl, "utf8")
  ]);

  assert.match(codeSource, /exportFigmaScreenAssets\(/);
  assert.match(codeSource, /referencePng:/);
  assert.match(uiSource, /await saveFigmaAssetToLocal\(/);
  assert.match(uiSource, /await saveFigmaReferenceToLocal\(/);
});

test("플러그인은 화면 스펙 저장과 분리된 Figma 원본 저장 버튼을 제공한다", async () => {
  const [codeSource, uiSource, uiHtml] = await Promise.all([
    readFile(codeUrl, "utf8"),
    readFile(uiUrl, "utf8"),
    readFile(uiHtmlUrl, "utf8")
  ]);

  assert.match(uiHtml, /id="save-figma-raw"/);
  assert.match(uiSource, /type:\s*"export-figma-raw"/);
  assert.match(uiSource, /await saveFigmaRawToLocal\(/);
  assert.match(codeSource, /message\?\.type === "export-figma-raw"/);
  assert.match(codeSource, /type:\s*"figma-raw-exported"/);
});
