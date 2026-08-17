import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeFigmaDesign } from "../packages/contracts/src/figma-design.mjs";

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
  assert.equal(nodes.find((node) => node.id === "7:44")?.assetRef, "assets/7-44.svg");
  assert.equal(design.assets.length, 11);

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
