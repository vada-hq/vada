import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  collectAssetNodes,
  normalizeFigmaDesign
} from "../packages/contracts/src/figma-design.mjs";

function createRawFixture() {
  return {
    document: {
      id: "1:1",
      name: "테스트 · TEST-01 · 정규화",
      type: "FRAME",
      blendMode: "PASS_THROUGH",
      clipsContent: true,
      background: [
        {
          blendMode: "NORMAL",
          type: "SOLID",
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ],
      fills: [
        {
          blendMode: "NORMAL",
          type: "SOLID",
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ],
      strokes: [],
      effects: [],
      interactions: [],
      layoutMode: "VERTICAL",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED",
      layoutSizingHorizontal: "FIXED",
      layoutSizingVertical: "FIXED",
      itemSpacing: 8,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      overflowDirection: "VERTICAL_SCROLLING",
      absoluteBoundingBox: { x: 100, y: 50, width: 320, height: 200 },
      absoluteRenderBounds: { x: 100, y: 50, width: 320, height: 200 },
      constraints: { horizontal: "LEFT", vertical: "TOP" },
      children: [
        {
          id: "1:2",
          name: "이름*",
          type: "TEXT",
          blendMode: "PASS_THROUGH",
          fills: [
            {
              blendMode: "NORMAL",
              type: "SOLID",
              color: { r: 0.2, g: 0.2, b: 0.2, a: 1 }
            }
          ],
          strokes: [],
          effects: [],
          interactions: [],
          layoutAlign: "INHERIT",
          layoutGrow: 0,
          layoutSizingHorizontal: "HUG",
          layoutSizingVertical: "HUG",
          absoluteBoundingBox: { x: 116, y: 66, width: 40, height: 20 },
          absoluteRenderBounds: { x: 117, y: 67, width: 38, height: 18 },
          constraints: { horizontal: "LEFT", vertical: "TOP" },
          characters: "이름*",
          characterStyleOverrides: [0, 0, 1],
          styleOverrideTable: {
            1: {
              fills: [
                {
                  blendMode: "NORMAL",
                  type: "SOLID",
                  color: { r: 1, g: 0, b: 0, a: 1 }
                }
              ]
            }
          },
          style: {
            fontFamily: "Inter",
            fontPostScriptName: null,
            fontStyle: "Medium",
            fontWeight: 500,
            fontSize: 14,
            textAlignHorizontal: "LEFT",
            textAlignVertical: "TOP",
            textAutoResize: "WIDTH_AND_HEIGHT",
            letterSpacing: 0,
            lineHeightPx: 20,
            lineHeightUnit: "PIXELS"
          }
        },
        {
          id: "1:3",
          name: "Arrow",
          type: "VECTOR",
          blendMode: "PASS_THROUGH",
          fills: [],
          strokes: [
            {
              blendMode: "NORMAL",
              type: "SOLID",
              color: { r: 0, g: 0, b: 0, a: 1 }
            }
          ],
          strokeWeight: 1.5,
          strokeAlign: "CENTER",
          strokeCap: "ROUND",
          effects: [],
          interactions: [],
          absoluteBoundingBox: { x: 390, y: 70, width: 14, height: 14 },
          absoluteRenderBounds: { x: 389, y: 69, width: 16, height: 16 },
          constraints: { horizontal: "SCALE", vertical: "SCALE" }
        }
      ]
    },
    components: {},
    componentSets: {},
    schemaVersion: 0,
    styles: {}
  };
}

test("Figma REST 원본을 결정적인 화면 구현용 구조로 정규화한다", () => {
  const raw = createRawFixture();
  const design = normalizeFigmaDesign(raw, { screenId: "TEST-01" });

  assert.deepEqual(design, {
    schemaVersion: 1,
    screenId: "TEST-01",
    source: {
      format: "JSON_REST_V1",
      nodeId: "1:1",
      rawFile: "figma.raw.json"
    },
    viewport: { width: 320, height: 200 },
    root: {
      id: "1:1",
      type: "frame",
      name: "테스트 · TEST-01 · 정규화",
      box: { x: 0, y: 0, width: 320, height: 200 },
      layout: {
        mode: "vertical",
        sizing: {
          horizontal: "fixed",
          vertical: "fixed",
          primaryAxis: "fixed",
          counterAxis: "fixed"
        },
        gap: 8,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        overflow: "vertical"
      },
      appearance: {
        fills: [{ type: "solid", color: "#FFFFFF" }],
        clipsContent: true
      },
      children: [
        {
          id: "1:2",
          type: "text",
          name: "이름*",
          box: { x: 16, y: 16, width: 40, height: 20 },
          layout: {
            sizing: { horizontal: "hug", vertical: "hug" }
          },
          appearance: {
            fills: [{ type: "solid", color: "#333333" }]
          },
          text: {
            content: "이름*",
            style: {
              fontFamily: "Inter",
              fontStyle: "Medium",
              fontWeight: 500,
              fontSize: 14,
              horizontalAlign: "left",
              verticalAlign: "top",
              autoResize: "width_and_height",
              lineHeight: { value: 20, unit: "pixels" }
            },
            runs: [
              {
                start: 2,
                end: 3,
                style: {
                  fills: [{ type: "solid", color: "#FF0000" }]
                }
              }
            ]
          }
        },
        {
          id: "1:3",
          type: "vector",
          name: "Arrow",
          box: { x: 290, y: 20, width: 14, height: 14 },
          layout: {
            constraints: { horizontal: "scale", vertical: "scale" }
          },
          appearance: {
            strokes: [{ type: "solid", color: "#000000" }],
            stroke: { weight: 1.5, align: "center", cap: "round" }
          },
          assetRef: "assets/1-3.svg"
        }
      ]
    },
    assets: [{ nodeId: "1:3", format: "svg", file: "assets/1-3.svg" }]
  });

  assert.deepEqual(
    normalizeFigmaDesign(structuredClone(raw), { screenId: "TEST-01" }),
    design
  );
  assert.equal(JSON.stringify(design).includes("absoluteRenderBounds"), false);
  assert.equal(JSON.stringify(design).includes("interactions"), false);
  assert.equal(JSON.stringify(design).includes("PASS_THROUGH"), false);
});

test("pill cornerRadius와 layoutGrow를 클램프하고 strokesIncludedInLayout을 보존한다", () => {
  const stroke = {
    blendMode: "NORMAL",
    type: "SOLID",
    color: { r: 0, g: 0, b: 0, a: 1 }
  };
  const raw = {
    document: {
      id: "2:1",
      name: "정제 규칙",
      type: "FRAME",
      layoutMode: "VERTICAL",
      absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
      children: [
        {
          id: "2:2",
          name: "Pill",
          type: "FRAME",
          cornerRadius: 3.4028234663852886e38,
          absoluteBoundingBox: { x: 0, y: 0, width: 17.5, height: 5.25 }
        },
        {
          id: "2:3",
          name: "Mixed Corners",
          type: "FRAME",
          rectangleCornerRadii: [3.4028234663852886e38, 0, 7, 0],
          absoluteBoundingBox: { x: 0, y: 10, width: 20, height: 10 }
        },
        {
          id: "2:4",
          name: "Grow",
          type: "FRAME",
          layoutGrow: 740,
          absoluteBoundingBox: { x: 0, y: 20, width: 100, height: 10 }
        },
        {
          id: "2:5",
          name: "Bordered Auto Layout",
          type: "FRAME",
          layoutMode: "VERTICAL",
          strokes: [stroke],
          strokeWeight: 1,
          strokesIncludedInLayout: true,
          paddingTop: 7,
          paddingRight: 10.5,
          paddingBottom: 7,
          paddingLeft: 10.5,
          absoluteBoundingBox: { x: 0, y: 30, width: 100, height: 33.5 }
        },
        {
          id: "2:6",
          name: "No Stroke Auto Layout",
          type: "FRAME",
          layoutMode: "VERTICAL",
          strokes: [],
          strokesIncludedInLayout: true,
          absoluteBoundingBox: { x: 0, y: 70, width: 100, height: 10 }
        },
        {
          id: "2:7",
          name: "Bordered Free Frame",
          type: "FRAME",
          strokes: [stroke],
          strokeWeight: 1,
          strokesIncludedInLayout: true,
          absoluteBoundingBox: { x: 0, y: 80, width: 100, height: 10 }
        }
      ]
    }
  };

  const design = normalizeFigmaDesign(raw, { screenId: "TEST-02" });
  const childById = new Map(
    design.root.children.map((child) => [child.id, child])
  );

  assert.equal(childById.get("2:2").appearance.cornerRadius, 2.625);
  assert.deepEqual(childById.get("2:3").appearance.cornerRadii, [5, 0, 5, 0]);
  assert.deepEqual(childById.get("2:4").layout, { grow: 1 });
  assert.equal(childById.get("2:5").layout.strokesIncludedInLayout, true);
  assert.equal(childById.get("2:6").layout?.strokesIncludedInLayout, undefined);
  assert.equal(childById.get("2:7").layout?.strokesIncludedInLayout, undefined);
  assert.equal(JSON.stringify(design).includes("e+38"), false);
});

test("화면 식별자와 루트 경계가 없는 원본은 명확히 거부한다", () => {
  const raw = createRawFixture();

  assert.throws(
    () => normalizeFigmaDesign(raw),
    /screenId/
  );
  assert.throws(
    () =>
      normalizeFigmaDesign(
        { ...raw, document: { ...raw.document, absoluteBoundingBox: undefined } },
        { screenId: "TEST-01" }
      ),
    /absoluteBoundingBox/
  );
});

test("ONB-01의 전체 노드와 GRID·혼합 텍스트·벡터 참조를 보존한다", async () => {
  const raw = JSON.parse(
    await readFile(
      new URL(
        "../specs/figma/vada-wireframe/screens/ONB-01/figma.raw.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const design = normalizeFigmaDesign(raw, { screenId: "ONB-01" });

  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    node.children?.forEach(visit);
  };
  visit(design.root);

  assert.equal(nodes.length, 83);
  assert.deepEqual(nodes.find((node) => node.id === "7:25")?.layout?.grid, {
    columns: 2,
    rows: 1,
    columnGap: 10.5,
    rowGap: 10.5,
    columnsSizing: "218.75px 218.75px",
    rowsSizing: "51.75px",
    itemsPositioning: "manual"
  });
  assert.deepEqual(nodes.find((node) => node.id === "7:28")?.text?.runs, [
    {
      start: 2,
      end: 3,
      style: {
        fills: [{ type: "solid", color: "#FB2C36" }]
      }
    }
  ]);
  // 자산 참조는 아이콘 묶음(7:43)이 갖고 안쪽 벡터(7:44)는 갖지 않는다.
  // 벡터마다 뽑으면 조각이 나와 아무도 쓸 수 없다.
  assert.equal(nodes.find((node) => node.id === "7:43")?.assetRef, "assets/7-43.svg");
  assert.equal(nodes.find((node) => node.id === "7:44")?.assetRef, undefined);
  assert.equal(design.assets.length, 7);

  assert.equal(nodes.find((node) => node.id === "7:13")?.appearance?.cornerRadius, 2.625);
  assert.equal(nodes.find((node) => node.id === "7:14")?.appearance?.cornerRadius, 2.625);
  assert.equal(nodes.find((node) => node.id === "7:2")?.layout?.grow, 1);
  assert.ok(
    nodes.every((node) => node.layout?.grow === undefined || node.layout.grow === 1)
  );
  assert.deepEqual(
    nodes
      .filter((node) => node.layout?.strokesIncludedInLayout === true)
      .map((node) => node.id),
    ["7:4", "7:29", "7:34", "7:46", "7:57", "7:68"]
  );

  const serialized = JSON.stringify(design);
  assert.equal(serialized.includes("absoluteBoundingBox"), false);
  assert.equal(serialized.includes("scrollBehavior"), false);
  assert.equal(serialized.includes("e+38"), false);
  assert.ok(serialized.length < JSON.stringify(raw).length * 0.65);
});

test("sourceHash 옵션을 provenance로 기록한다", () => {
  const raw = createRawFixture();
  const hash = "a".repeat(64);

  const withHash = normalizeFigmaDesign(raw, { screenId: "TEST-01", sourceHash: hash });
  assert.equal(withHash.source.hash, hash);

  const withoutHash = normalizeFigmaDesign(raw, { screenId: "TEST-01" });
  assert.equal("hash" in withoutHash.source, false);
});

// HOME-01K에서 벡터 64개 중 3개가 이 오류로 export를 거부당했다:
// "Failed to export node. This node may not have any visible layers."
// 세 노드만 absoluteRenderBounds가 null이었고, 등록된 6개 화면을 전부 대조해도
// null인 벡터는 그 셋뿐이었다. 그리는 것이 없는 벡터는 자산이 아니다.
test("아무것도 그리지 않는 벡터는 자산으로 참조하지 않는다", () => {
  const vector = (id, renderBounds) => ({
    id,
    name: "Vector",
    type: "VECTOR",
    absoluteBoundingBox: { x: 0, y: 0, width: 4, height: 4 },
    absoluteRenderBounds: renderBounds
  });

  const raw = {
    document: {
      id: "1:1",
      name: "테스트 · TEST-02 · 빈 벡터",
      type: "FRAME",
      absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
      children: [
        { id: "1:9", type: "TEXT", absoluteRenderBounds: { x: 0, y: 0, width: 2, height: 2 } },
        vector("1:2", { x: 0, y: 0, width: 4, height: 4 }),
        vector("1:3", null)
      ]
    }
  };

  const design = normalizeFigmaDesign(raw, { screenId: "TEST-02" });

  assert.deepEqual(
    design.assets.map((asset) => asset.nodeId),
    ["1:2"]
  );
  const [, drawn, empty] = design.root.children;
  assert.equal(drawn.assetRef, "assets/1-2.svg");
  assert.equal("assetRef" in empty, false);
  // 노드 자체는 남는다 — 사라지면 트리가 어긋난다.
  assert.equal(empty.id, "1:3");
});

// 아이콘 하나는 보통 벡터 여러 개로 그려진다. 벡터마다 SVG를 뽑으면 조각이
// 나와 아무도 쓸 수 없다 — HOME-01K는 아이콘 22개가 파일 61개로 흩어졌다.
// 자산의 단위는 '벡터만 품은 가장 바깥 노드'다.
test("아이콘은 벡터 조각이 아니라 묶음 하나로 뽑는다", () => {
  const vector = (id) => ({
    id,
    type: "VECTOR",
    absoluteRenderBounds: { x: 0, y: 0, width: 1, height: 1 }
  });
  const root = {
    id: "1:1",
    type: "FRAME",
    absoluteRenderBounds: { x: 0, y: 0, width: 10, height: 10 },
    children: [
      {
        id: "1:2",
        name: "Icon",
        type: "FRAME",
        absoluteRenderBounds: { x: 0, y: 0, width: 4, height: 4 },
        children: [vector("1:3"), vector("1:4"), vector("1:5")]
      },
      // 텍스트가 섞이면 아이콘이 아니다. 안쪽 벡터를 따로 뽑는다.
      {
        id: "1:6",
        type: "FRAME",
        absoluteRenderBounds: { x: 0, y: 0, width: 8, height: 4 },
        children: [{ id: "1:7", type: "TEXT" }, vector("1:8")]
      }
    ]
  };

  assert.deepEqual(
    collectAssetNodes(root).map((asset) => [asset.node.id, asset.format]),
    [
      ["1:2", "svg"],
      ["1:8", "svg"]
    ]
  );
});

test("이미지 fill을 가진 노드는 png 자산이다", () => {
  const root = {
    id: "1:1",
    type: "FRAME",
    absoluteRenderBounds: { x: 0, y: 0, width: 10, height: 10 },
    children: [
      {
        id: "1:2",
        name: "KkirukMark",
        type: "FRAME",
        absoluteRenderBounds: { x: 0, y: 0, width: 4, height: 4 },
        fills: [{ type: "IMAGE", imageRef: "abc", scaleMode: "FIT" }]
      }
    ]
  };

  assert.deepEqual(
    collectAssetNodes(root).map((asset) => [asset.node.id, asset.format]),
    [["1:2", "png"]]
  );
});

test("그리는 것이 없는 노드는 묶음이든 낱개든 자산이 아니다", () => {
  const root = {
    id: "1:1",
    type: "FRAME",
    absoluteRenderBounds: { x: 0, y: 0, width: 10, height: 10 },
    children: [
      { id: "1:2", type: "VECTOR", absoluteRenderBounds: null },
      {
        id: "1:3",
        type: "FRAME",
        absoluteRenderBounds: null,
        children: [{ id: "1:4", type: "VECTOR", absoluteRenderBounds: null }]
      }
    ]
  };

  assert.deepEqual(collectAssetNodes(root), []);
});

test("자산 판별은 플러그인과 정규화기가 같은 규칙을 쓴다", () => {
  const at = (root) => collectAssetNodes(root).map((asset) => asset.node.id);
  const box = { x: 0, y: 0, width: 1, height: 1 };

  // 화면 루트에는 텍스트가 섞이므로 루트 자신은 아이콘이 되지 않는다.
  const screen = (child) => ({
    id: "r",
    type: "FRAME",
    absoluteRenderBounds: box,
    children: [{ id: "t", type: "TEXT", absoluteRenderBounds: box }, child]
  });

  assert.deepEqual(at(screen({ id: "1:2", type: "VECTOR", absoluteRenderBounds: box })), ["1:2"]);
  // 값이 없으면(undefined) 판정하지 않는다 — 옛 원본을 소급해 떨어뜨리면
  // 이미 저장된 자산이 고아가 된다.
  assert.deepEqual(at(screen({ id: "1:2", type: "BOOLEAN_OPERATION" })), ["1:2"]);
  assert.deepEqual(at(screen({ id: "1:2", type: "TEXT" })), []);
});

// 자산의 단위는 "벡터만 품은 가장 바깥 노드"인데, 그 판정이 두 곳에서 틀렸다.
// 둘 다 실제로 겪은 일이고 둘 다 화면에 그릴 수 없는 파일을 만들었다.

test("글이 든 줄은 한 자산이 아니다 — Figma가 글의 렌더 범위를 안 줘도", () => {
  // OPS-MEET-01A의 18:720이 582×19짜리 한 덩이로 뽑혔다. 보이는 글인데도
  // absoluteRenderBounds가 null이라(500개 중 23개가 그렇다) '있으나 마나'로 읽혔다.
  const box = (x, width) => ({ x, y: 0, width, height: 12 });
  const icon = (id, x) => ({
    id,
    type: "FRAME",
    name: "Icon",
    absoluteBoundingBox: box(x, 12),
    absoluteRenderBounds: box(x, 12),
    children: [{ id: `${id}v`, type: "VECTOR", absoluteRenderBounds: box(x, 12), children: [] }]
  });
  const row = {
    id: "1:100",
    type: "FRAME",
    name: "Container",
    absoluteBoundingBox: box(0, 200),
    absoluteRenderBounds: box(0, 200),
    children: [
      {
        id: "1:101",
        type: "FRAME",
        absoluteBoundingBox: box(0, 90),
        absoluteRenderBounds: box(0, 90),
        children: [
          icon("1:102", 0),
          // 보이는 글인데 Figma가 렌더 범위를 주지 않았다.
          { id: "1:103", type: "TEXT", characters: "2026.07.15", absoluteRenderBounds: null, children: [] }
        ]
      },
      {
        id: "1:104",
        type: "FRAME",
        absoluteBoundingBox: box(100, 90),
        absoluteRenderBounds: box(100, 90),
        children: [
          icon("1:105", 100),
          { id: "1:106", type: "TEXT", characters: "학생회실", absoluteRenderBounds: null, children: [] }
        ]
      }
    ]
  };

  const ids = collectAssetNodes(row).map((asset) => asset.node.id);
  assert.deepEqual(ids, ["1:102", "1:105"], "글이 든 줄을 통째로 한 자산으로 뽑았습니다");
});

test("멀리 떨어진 아이콘 둘은 한 자산이 아니다", () => {
  // OPS-00의 카드 머리 줄(16:615)은 왼쪽 타일과 오른쪽 끝 화살표만 든 Container다.
  // 글이 없어 '벡터만 품은 노드'가 맞지만, 사이가 334px 비어 있어 383×35짜리
  // 파일이 나왔고 어느 자리에도 그릴 수 없었다.
  //
  // 임계값은 재서 정했다 — 자식 둘 이상인 자산 111개 중 이 넷만 87%이고 나머지는
  // 전부 25% 이하다.
  const at = (x, width) => ({ x, y: 0, width, height: 35 });
  const part = (id, x, width) => ({
    id,
    type: "FRAME",
    absoluteBoundingBox: at(x, width),
    absoluteRenderBounds: at(x, width),
    children: [{ id: `${id}v`, type: "VECTOR", absoluteRenderBounds: at(x, width), children: [] }]
  });
  const head = {
    id: "1:200",
    type: "FRAME",
    absoluteBoundingBox: at(0, 383),
    absoluteRenderBounds: at(0, 383),
    children: [part("1:201", 0, 35), part("1:202", 369, 14)]
  };
  assert.deepEqual(collectAssetNodes(head).map((asset) => asset.node.id), ["1:201", "1:202"]);

  // 붙어 있는 조각들은 한 아이콘이다. 가르면 조각이 나와 아무도 쓸 수 없다.
  const glyph = {
    id: "1:300",
    type: "FRAME",
    absoluteBoundingBox: at(0, 14),
    absoluteRenderBounds: at(0, 14),
    children: [part("1:301", 0, 6), part("1:302", 8, 6)]
  };
  assert.deepEqual(collectAssetNodes(glyph).map((asset) => asset.node.id), ["1:300"]);
});
