import assert from "node:assert/strict";
import { test } from "node:test";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";
import { element, inputSpec } from "./spec-validation-fixtures.mjs";

test("design에 있는데 명세에 없는 상호작용은 오류로 보고한다", () => {
  // 대조가 명세 → 화면 한 방향이라 명세의 구멍은 통과했다. TASK-01의 헤더 버튼
  // '업무 추가'(18:86)가 그렇게 조용히 빠져 있었다.
  const design = {
    schemaVersion: 1,
    screenId: "SCR-01",
    root: {
      id: "1:1",
      type: "frame",
      name: "SCR-01",
      children: [
        {
          id: "2:1",
          type: "frame",
          name: "Sidebar",
          // 셸은 화면의 요소가 아니다. 이름으로 제외된다.
          children: [{ id: "2:2", type: "frame", name: "Btn", children: [
            { id: "2:3", type: "text", name: "t", text: { content: "홈" } }
          ] }]
        },
        {
          id: "3:1",
          type: "frame",
          name: "Btn",
          children: [{ id: "3:2", type: "text", name: "t", text: { content: "업무 추가" } }]
        },
        {
          id: "4:1",
          type: "frame",
          name: "Container",
          children: [
            // 등록 요소 안의 버튼은 그 요소의 내부다.
            { id: "4:2", type: "frame", name: "Btn", children: [
              { id: "4:3", type: "text", name: "t", text: { content: "항목 열기" } }
            ] },
            // 문구 없는 조작은 명세에 적을 라벨이 없다.
            { id: "4:4", type: "frame", name: "Dropdown", children: [] }
          ]
        }
      ]
    },
    assets: []
  };
  const designs = {
    "SCR-01": {
      file: "screens/SCR-01/figma.design.json",
      design,
      assetFiles: [],
      hasReference: true
    }
  };
  const screen = {
    file: "screens/SCR-01/screen.json",
    spec: {
      schemaVersion: 1,
      screenId: "SCR-01",
      source: { nodeId: "1:1" },
      elements: [
        {
          source: { nodeId: "4:1" },
          spec: {
            type: "itemList",
            title: "항목 열기",
            dataSourceKey: "x.list",
            itemAction: { type: "pending", note: "미정" }
          }
        }
      ]
    }
  };
  const shell = { design: { excludeNodeNames: ["Sidebar"] } };

  const findings = collectSpecFindings({ screens: [screen], designs, shell });
  const messages = findings.map((finding) => finding.message);

  assert.ok(
    messages.some((message) => message.includes("3:1") && message.includes("업무 추가")),
    `등록되지 않은 헤더 버튼을 잡지 못했습니다: ${messages.join(" | ")}`
  );
  assert.ok(
    !messages.some((message) => message.includes("4:2")),
    "등록 요소 안의 버튼을 바깥 것으로 셌습니다"
  );
  assert.ok(
    !messages.some((message) => message.includes("4:4")),
    "문구 없는 드롭다운을 셌습니다"
  );
  assert.ok(
    !messages.some((message) => message.includes("2:2")),
    "셸 안의 버튼을 셌습니다"
  );
});

test("등록 노드가 요소의 라벨을 품지 않으면 오류로 보고한다", () => {
  // ProfileSearchSelect(래퍼) = Label + Text Input(placeholder).
  // 안쪽 Text Input만 등록하면 라벨이 등록 노드 바깥에 남는다.
  const design = {
    schemaVersion: 1,
    screenId: "SCR-01",
    root: {
      id: "1:1",
      type: "frame",
      name: "SCR-01",
      children: [
        {
          id: "7:39",
          type: "frame",
          name: "ProfileSearchSelect",
          children: [
            {
              id: "7:40",
              type: "frame",
              name: "Label",
              children: [{ id: "7:41", type: "text", name: "학교*", text: { content: "학교*" } }]
            },
            {
              id: "7:46",
              type: "frame",
              name: "Text Input",
              // placeholder가 라벨을 부분 문자열로 품는다 — 부분 일치로는 못 걸러낸다.
              children: [
                { id: "7:47", type: "text", name: "t", text: { content: "학교명을 검색하세요" } }
              ]
            }
          ]
        }
      ]
    },
    assets: []
  };
  const selectSpec = {
    type: "select",
    fieldKey: "school",
    label: "학교",
    placeholder: null,
    initialValue: null,
    valueType: "string",
    required: true,
    initiallyDisabled: false,
    searchable: true,
    optionsSource: { key: "education.schools" }
  };
  const designs = {
    "SCR-01": {
      file: "screens/SCR-01/figma.design.json",
      design,
      assetFiles: [],
      hasReference: true
    }
  };
  const makeScreen = (nodeId, name) => [
    {
      file: "screens/SCR-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SCR-01",
        source: { pageName: "P", nodeId: "1:1", name: "SCR-01", figmaType: "FRAME" },
        elements: [{ source: { nodeId, name, figmaType: "FRAME" }, spec: selectSpec }]
      }
    }
  ];

  const inner = collectSpecFindings({ screens: makeScreen("7:46", "Text Input"), designs });
  assert.ok(
    inner.some(
      (finding) => finding.level === "error" && finding.message.includes("대표하지 않습니다")
    ),
    "안쪽 컨트롤만 등록하면 오류여야 한다"
  );

  const wrapper = collectSpecFindings({
    screens: makeScreen("7:39", "ProfileSearchSelect"),
    designs
  });
  assert.deepEqual(
    wrapper.filter((finding) => finding.message.includes("대표하지 않습니다")),
    [],
    "라벨과 컨트롤을 모두 품는 래퍼는 통과해야 한다"
  );
});

// 플러그인은 스키마 선언 순서로 화면 JSON을 쓴다. 손으로 쓴 파일의 순서가
// 다르면 Figma에서 저장할 때마다 순서만 바뀐 diff가 나오고, 그러면
// "저장 후 git diff가 비어 있다"를 왕복 보존의 신호로 쓸 수 없게 된다.
test("collectSpecFindings는 요소 속성 순서가 스키마 선언 순서와 다르면 오류로 보고한다", () => {
  const propertyOrderByType = {
    input: ["type", "fieldKey", "label", "placeholder", "initialValue", "inputType", "valueType", "required", "validation"]
  };
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:1", inputSpec("name")),
          // required를 valueType 앞으로 옮겼다. 값은 같고 순서만 다르다.
          element("1:2", {
            type: "input",
            fieldKey: "phone",
            label: "phone",
            placeholder: null,
            initialValue: null,
            inputType: "text",
            required: true,
            valueType: "string",
            validation: []
          })
        ]
      }
    }
  ];

  const findings = collectSpecFindings({ screens, propertyOrderByType });
  const orderFindings = findings.filter((finding) =>
    finding.message.includes("속성 순서")
  );

  assert.equal(orderFindings.length, 1, `기대와 다름: ${JSON.stringify(findings)}`);
  assert.equal(orderFindings[0].level, "error");
  assert.match(orderFindings[0].message, /elements\[1\]/u);
});

test("collectSpecFindings는 순서 원본이 없으면 순서를 검사하지 않는다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "input",
            fieldKey: "phone",
            label: "phone",
            placeholder: null,
            initialValue: null,
            inputType: "text",
            required: true,
            valueType: "string",
            validation: []
          })
        ]
      }
    }
  ];

  assert.deepEqual(
    collectSpecFindings({ screens }).filter((finding) =>
      finding.message.includes("속성 순서")
    ),
    []
  );
});
// 모달은 아래 화면 위에 뜬다. 디자인이 그것을 화면 전체와 형제로 그리므로,
// 이 화면이 그리는 부분 밖은 아래 화면의 것이다.
function overlayScreen(overlay) {
  const design = {
    schemaVersion: 1,
    screenId: "S-02",
    root: {
      id: "1:0",
      type: "frame",
      name: "S-02",
      children: [
        {
          id: "1:1",
          type: "frame",
          name: "DesktopShell",
          children: [
            {
              id: "1:2",
              type: "frame",
              name: "Btn",
              children: [{ id: "1:3", type: "text", name: "t", text: { content: "아래 화면의 버튼" } }]
            }
          ]
        },
        {
          id: "1:4",
          type: "frame",
          name: "Modal",
          children: [
            {
              id: "1:5",
              type: "frame",
              name: "Btn",
              children: [{ id: "1:6", type: "text", name: "t", text: { content: "닫기" } }]
            }
          ]
        }
      ]
    },
    assets: []
  };

  return {
    screens: [
      {
        file: "screens/S-02/screen.json",
        spec: {
          schemaVersion: 1,
          screenId: "S-02",
          ...(overlay ? { overlay } : {}),
          source: { nodeId: "1:0" },
          elements: [
            {
              source: { nodeId: "1:5" },
              spec: {
                type: "button",
                label: "닫기",
                emphasis: "secondary",
                initiallyDisabled: false,
                action: { type: "navigate", targetScreenId: "S-01" }
              }
            }
          ]
        }
      },
      { file: "screens/S-01/screen.json", spec: { schemaVersion: 1, screenId: "S-01", elements: [] } }
    ],
    designs: {
      "S-02": {
        file: "screens/S-02/figma.design.json",
        design,
        assetFiles: [],
        hasReference: true
      }
    }
  };
}

test("겹쳐 뜨는 화면은 아래 화면의 버튼을 자기 것으로 세지 않는다", () => {
  const findings = collectSpecFindings(
    overlayScreen({ screenId: "S-01", source: "1:4" })
  );

  assert.equal(
    findings.filter((f) => f.message.includes("아래 화면의 버튼")).length,
    0,
    findings.map((f) => f.message).join(" | ")
  );
});

test("겹쳐 뜬다고 말하지 않으면 아래 화면의 버튼이 빠진 것으로 보인다", () => {
  const findings = collectSpecFindings(overlayScreen(null));

  assert.equal(
    findings.filter((f) => f.message.includes("아래 화면의 버튼")).length,
    1,
    findings.map((f) => f.message).join(" | ")
  );
});

// 변형은 본 화면을 다르게 그린 것이다. 함께 있는 것을 다시 세면 회의 목록의
// 검색·줄 단추가 네 번 '명세에 없다'고 나온다.
test("변형은 본 화면과 함께 있는 것을 다시 세지 않는다", () => {
  const base = overlayScreen(null);
  base.screens[0].spec.variantOf = { screenId: "S-01", when: "진행 권한이 있는 사람이 볼 때" };
  delete base.screens[0].spec.overlay;

  const findings = collectSpecFindings(base);

  assert.equal(
    findings.filter((f) => f.message.includes("아래 화면의 버튼")).length,
    0,
    findings.map((f) => f.message).join(" | "),
  );
});
