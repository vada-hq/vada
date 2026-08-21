import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ASSET_PNG_SCALE,
  REFERENCE_PNG_SCALE,
  exportFigmaRaw,
  exportFigmaScreenAssets,
  toErrorMessage
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

// 자산의 단위는 벡터 하나가 아니라 아이콘 묶음이다(collectAssetNodes).
// 화면 루트에는 텍스트가 섞이므로 루트 자신은 아이콘이 되지 않는다.
const BOX = { x: 0, y: 0, width: 4, height: 4 };

function vectorNode(id, exportImpl) {
  return {
    id,
    type: "VECTOR",
    absoluteRenderBounds: BOX,
    exportAsync: exportImpl
  };
}

function screenNodeWith({ children, screenExport }) {
  return {
    id: "7:1",
    type: "FRAME",
    absoluteRenderBounds: BOX,
    children: [{ id: "7:2", type: "TEXT", absoluteRenderBounds: BOX }, ...children],
    exportAsync: screenExport
  };
}

test("아이콘 묶음은 하나로, 낱개 벡터는 그대로 뽑고 참조 PNG를 함께 낸다", async () => {
  const exportCalls = [];
  const svgOf = (id) => async (settings) => {
    exportCalls.push([id, settings]);
    return `<svg data-node="${id}"></svg>`;
  };
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

  const screenNode = screenNodeWith({
    children: [
      {
        id: "7:40",
        name: "Icon",
        type: "FRAME",
        absoluteRenderBounds: BOX,
        exportAsync: svgOf("7:40"),
        children: [vectorNode("7:41"), vectorNode("7:42")]
      },
      vectorNode("7:90", svgOf("7:90"))
    ],
    screenExport: async (settings) => {
      exportCalls.push(["screen", settings]);
      return pngBytes;
    }
  });

  const result = await exportFigmaScreenAssets(screenNode);

  assert.deepEqual(result.assets, [
    { nodeId: "7:40", fileName: "7-40.svg", format: "svg", svg: '<svg data-node="7:40"></svg>' },
    { nodeId: "7:90", fileName: "7-90.svg", format: "svg", svg: '<svg data-node="7:90"></svg>' }
  ]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.referencePng, pngBytes);
  assert.equal(REFERENCE_PNG_SCALE, 2);
  assert.deepEqual(exportCalls, [
    ["7:40", { format: "SVG_STRING" }],
    ["7:90", { format: "SVG_STRING" }],
    ["screen", { format: "PNG", constraint: { type: "SCALE", value: 2 } }]
  ]);
});

test("이미지 fill을 가진 노드는 PNG 바이트로 뽑는다", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const screenNode = screenNodeWith({
    children: [
      {
        id: "7:87",
        name: "KkirukMark",
        type: "FRAME",
        absoluteRenderBounds: BOX,
        fills: [{ type: "IMAGE", imageRef: "abc" }],
        exportAsync: async () => bytes
      }
    ],
    screenExport: async () => new Uint8Array([9])
  });

  const result = await exportFigmaScreenAssets(screenNode);

  assert.deepEqual(result.assets, [
    { nodeId: "7:87", fileName: "7-87.png", format: "png", bytes }
  ]);
  assert.equal(ASSET_PNG_SCALE, 2);
});

// HOME-01K에서 자산 하나가 실패하자 나머지와 reference.png까지 통째로
// 버려졌다. 실패한 것만 보고하고 나머지는 건진다.
test("자산 하나가 실패해도 나머지와 참조 PNG는 건진다", async () => {
  const pngBytes = new Uint8Array([0x89, 0x50]);
  const screenNode = screenNodeWith({
    children: [
      vectorNode("7:44", async () => ""),
      vectorNode("7:90", async () => '<svg data-node="7:90"></svg>')
    ],
    screenExport: async () => pngBytes
  });

  const result = await exportFigmaScreenAssets(screenNode);

  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].nodeId, "7:90");
  assert.equal(result.referencePng, pngBytes);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /7:44/u);
});

test("참조 PNG가 실패해도 자산은 건지고 실패만 보고한다", async () => {
  const screenNode = screenNodeWith({
    children: [vectorNode("7:90", async () => '<svg data-node="7:90"></svg>')],
    screenExport: async () => null
  });

  const result = await exportFigmaScreenAssets(screenNode);

  assert.equal(result.assets.length, 1)
  assert.equal(result.referencePng, null);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /PNG/u);
});

// Figma 샌드박스가 던지는 값은 Error 인스턴스가 아닐 수 있다. instanceof로
// 거르면 진짜 원인이 사라지고 fallback 문구만 남는다(HOME-01K에서 실제로 그랬다).
test("Error가 아닌 값을 던져도 메시지를 잃지 않는다", async () => {
  assert.equal(toErrorMessage(new Error("진짜 원인")), "진짜 원인");
  assert.equal(toErrorMessage("문자열로 던짐"), "문자열로 던짐");
  assert.equal(toErrorMessage({ message: "다른 렐름의 오류" }), "다른 렐름의 오류");
  assert.match(toErrorMessage(undefined), /알 수 없는/u);

  const screenNode = screenNodeWith({
    children: [
      vectorNode("7:44", async () => {
        throw { message: "Cannot export node with no area" };
      })
    ],
    screenExport: async () => new Uint8Array([1])
  });

  const result = await exportFigmaScreenAssets(screenNode);
  assert.match(result.failures[0], /Cannot export node with no area/u);
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
