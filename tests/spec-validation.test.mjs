import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";
import { validateSpecsRoot } from "../apps/spec-service/src/validate-specs.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function inputSpec(fieldKey, overrides = {}) {
  return {
    type: "input",
    fieldKey,
    label: fieldKey,
    placeholder: null,
    initialValue: null,
    inputType: "text",
    valueType: "string",
    required: true,
    validation: [],
    ...overrides
  };
}

function element(nodeId, spec) {
  return {
    source: { nodeId, name: spec.fieldKey ?? spec.label ?? nodeId, figmaType: "FRAME" },
    spec
  };
}

test("collectSpecFindings는 교차 참조 오류를 모두 찾는다", () => {
  const screens = [
    {
      file: "screens/SCR-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SCR-01",
        stateScopeKey: "missingScope",
        source: { pageName: "P", nodeId: "1:1", name: "SCR-01", figmaType: "FRAME" },
        elements: [
          element("9:1", inputSpec("dupKey")),
          element("9:2", inputSpec("dupKey")),
          element("9:3", {
            type: "select",
            fieldKey: "unknownSource",
            label: "unknownSource",
            placeholder: null,
            initialValue: null,
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: true,
            optionsSource: { key: "nope.key" }
          }),
          element("9:4", {
            type: "select",
            fieldKey: "missingParam",
            label: "missingParam",
            placeholder: null,
            initialValue: null,
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: true,
            optionsSource: { key: "real.key" },
            enabledWhen: [{ fieldKey: "ghostField", operator: "hasValue" }],
            resetOnChangeOf: ["ghostReset"]
          }),
          element("9:5", {
            type: "button",
            label: "다음",
            initiallyDisabled: false,
            action: {
              type: "navigate",
              targetScreenId: "SCR-99",
              executeWhen: { type: "allRequiredFieldsHaveValue", scope: "screen" },
              onExecutionBlocked: {
                type: "showMissingRequiredFields",
                focus: "firstMissingField"
              }
            }
          })
        ]
      }
    }
  ];
  const optionSources = {
    schemaVersion: 2,
    sources: [
      {
        key: "real.key",
        type: "static",
        description: "테스트",
        params: ["schoolId"],
        options: [{ value: "1", label: "하나" }]
      }
    ]
  };
  const stateScopes = {
    schemaVersion: 1,
    scopes: [
      { key: "onboardingDraft", description: "d", lifetime: "flow", clearOn: ["complete"] }
    ]
  };
  const designs = {
    "SCR-01": {
      file: "screens/SCR-01/figma.design.json",
      design: {
        schemaVersion: 1,
        screenId: "SCR-01",
        root: { id: "1:1", type: "frame", name: "SCR-01", children: [] },
        assets: [{ nodeId: "7:7", format: "svg", file: "assets/7-7.svg" }]
      },
      assetFiles: [],
      hasReference: false
    }
  };

  const findings = collectSpecFindings({ screens, optionSources, stateScopes, designs });
  const errors = findings.filter((finding) => finding.level === "error");
  const warnings = findings.filter((finding) => finding.level === "warning");
  const hasError = (part) => errors.some((finding) => finding.message.includes(part));
  const hasWarning = (part) => warnings.some((finding) => finding.message.includes(part));

  assert.ok(hasError("dupKey"), "중복 fieldKey 오류가 있어야 한다");
  assert.ok(hasError("nope.key"), "카탈로그에 없는 선택지 출처 오류가 있어야 한다");
  assert.ok(hasError("schoolId"), "누락된 인자 매핑 오류가 있어야 한다");
  assert.ok(hasError("ghostField"), "enabledWhen의 없는 fieldKey 오류가 있어야 한다");
  assert.ok(hasError("ghostReset"), "resetOnChangeOf의 없는 fieldKey 오류가 있어야 한다");
  assert.ok(hasError("missingScope"), "카탈로그에 없는 상태 스코프 오류가 있어야 한다");
  assert.ok(hasError("9:1"), "design.json에 없는 nodeId 오류가 있어야 한다");
  assert.ok(hasError("assets/7-7.svg"), "없는 자산 파일 오류가 있어야 한다");
  assert.ok(hasWarning("SCR-99"), "없는 이동 대상 화면은 경고여야 한다");
  assert.ok(hasWarning("reference.png"), "reference.png 부재는 경고여야 한다");
});

test("collectSpecFindings는 정합한 명세에서 아무것도 보고하지 않는다", () => {
  const screens = [
    {
      file: "screens/SCR-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SCR-01",
        stateScopeKey: "onboardingDraft",
        source: { pageName: "P", nodeId: "1:1", name: "SCR-01", figmaType: "FRAME" },
        elements: [
          element("9:1", inputSpec("name")),
          element("9:5", {
            type: "button",
            label: "다음",
            initiallyDisabled: false,
            action: {
              type: "navigate",
              targetScreenId: "SCR-02",
              executeWhen: { type: "allRequiredFieldsHaveValue", scope: "screen" },
              onExecutionBlocked: {
                type: "showMissingRequiredFields",
                focus: "firstMissingField"
              }
            }
          })
        ]
      }
    },
    {
      file: "screens/SCR-02/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SCR-02",
        source: { pageName: "P", nodeId: "2:1", name: "SCR-02", figmaType: "FRAME" },
        elements: []
      }
    }
  ];
  const stateScopes = {
    schemaVersion: 1,
    scopes: [
      { key: "onboardingDraft", description: "d", lifetime: "flow", clearOn: ["complete"] }
    ]
  };
  const designs = {
    "SCR-01": {
      file: "screens/SCR-01/figma.design.json",
      design: {
        schemaVersion: 1,
        screenId: "SCR-01",
        root: {
          id: "1:1",
          type: "frame",
          name: "SCR-01",
          // 등록 노드는 요소의 라벨을 품어야 한다(element-types.md의 등록 노드 계약).
          children: [
            {
              id: "9:1",
              type: "frame",
              name: "name",
              children: [
                { id: "9:2", type: "text", name: "Label", text: { content: "name" } }
              ]
            },
            {
              id: "9:5",
              type: "frame",
              name: "다음",
              children: [
                { id: "9:6", type: "text", name: "Label", text: { content: "다음" } }
              ]
            },
            { id: "7:7", type: "vector", name: "icon", assetRef: "assets/7-7.svg" }
          ]
        },
        assets: [{ nodeId: "7:7", format: "svg", file: "assets/7-7.svg" }]
      },
      assetFiles: ["7-7.svg"],
      hasReference: true
    }
  };

  const findings = collectSpecFindings({
    screens,
    optionSources: { schemaVersion: 2, sources: [] },
    stateScopes,
    designs
  });
  assert.deepEqual(findings, []);
});

test("collectSpecFindings는 note의 스코프·필드 참조를 교차 검사한다", () => {
  const screens = [
    {
      file: "screens/SRC-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SRC-01",
        stateScopeKey: "sourceScope",
        source: { pageName: "P", nodeId: "1:1", name: "SRC-01", figmaType: "FRAME" },
        elements: [element("9:1", inputSpec("knownField"))]
      }
    },
    {
      file: "screens/VIEW-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "VIEW-01",
        source: { pageName: "P", nodeId: "2:1", name: "VIEW-01", figmaType: "FRAME" },
        elements: [
          element("9:9", {
            type: "note",
            prefix: "참고: ",
            fieldRefs: [
              { scope: "sourceScope", fieldKey: "knownField" },
              { scope: "sourceScope", fieldKey: "ghostField" },
              { scope: "missingScope", fieldKey: "whatever" }
            ]
          })
        ]
      }
    }
  ];
  const stateScopes = {
    schemaVersion: 1,
    scopes: [
      { key: "sourceScope", description: "d", lifetime: "flow", clearOn: ["complete"] }
    ]
  };

  const findings = collectSpecFindings({ screens, stateScopes });
  const errors = findings.filter((finding) => finding.level === "error");
  assert.ok(
    errors.some((finding) => finding.message.includes("ghostField")),
    "스코프에 없는 fieldKey 참조는 오류여야 한다"
  );
  assert.ok(
    errors.some((finding) => finding.message.includes("missingScope")),
    "카탈로그에 없는 스코프 참조는 오류여야 한다"
  );
  assert.ok(
    !findings.some((finding) => finding.message.includes("knownField")),
    "존재하는 참조는 보고하지 않는다"
  );
});

test("collectSpecFindings는 묶음의 멤버 필드 존재와 단일 소속을 검사한다", () => {
  const screens = [
    {
      file: "screens/GRP-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "GRP-01",
        source: { pageName: "P", nodeId: "1:1", name: "GRP-01", figmaType: "FRAME" },
        elements: [
          element("9:1", inputSpec("alpha")),
          element("9:2", inputSpec("beta")),
          element("9:3", {
            type: "group",
            title: "첫 묶음",
            memberFieldKeys: ["alpha", "ghostField"]
          }),
          element("9:4", {
            type: "group",
            title: "둘째 묶음",
            memberFieldKeys: ["alpha", "beta"]
          })
        ]
      }
    }
  ];

  const errors = collectSpecFindings({ screens }).filter(
    (finding) => finding.level === "error"
  );

  assert.ok(
    errors.some((finding) => finding.message.includes("ghostField")),
    "화면에 없는 fieldKey를 묶으면 오류여야 한다"
  );
  assert.ok(
    errors.some((finding) => finding.message.includes("이미 다른 묶음")),
    "한 필드가 두 묶음에 속하면 오류여야 한다"
  );
  assert.ok(
    !errors.some((finding) => finding.message.includes("'beta'")),
    "한 묶음에만 속한 필드는 보고하지 않는다"
  );
});

test("collectSpecFindings는 흐름 카탈로그의 참조와 중복 멤버십을 검사한다", () => {
  const screens = [
    {
      file: "screens/SCR-01/screen.json",
      spec: {
        schemaVersion: 1,
        screenId: "SCR-01",
        source: { pageName: "P", nodeId: "1:1", name: "SCR-01", figmaType: "FRAME" },
        elements: []
      }
    }
  ];
  const flows = {
    schemaVersion: 1,
    flows: [
      {
        key: "a",
        screens: [
          { screenId: "SCR-01", label: "일단계" },
          { screenId: "SCR-99", label: "이단계" }
        ]
      },
      { key: "b", screens: [{ screenId: "SCR-01", label: "다른 일단계" }] }
    ]
  };

  const findings = collectSpecFindings({ screens, flows });
  assert.ok(
    findings.some(
      (finding) =>
        finding.level === "warning" && finding.message.includes("SCR-99")
    ),
    "흐름이 참조한 미작성 화면은 경고여야 한다"
  );
  assert.ok(
    findings.some(
      (finding) =>
        finding.level === "error" &&
        finding.message.includes("여러 흐름") &&
        finding.message.includes("SCR-01")
    ),
    "여러 흐름에 속한 화면은 오류여야 한다"
  );
});

test("validateSpecsRoot는 실제 저장소 명세에서 오류 0건이어야 한다", async () => {
  const findings = await validateSpecsRoot(join(repoRoot, "specs", "figma"));
  const errors = findings.filter((finding) => finding.level === "error");
  assert.deepEqual(errors, []);
});

test("validateSpecsRoot는 raw와 design의 신선도 불일치를 오류로 보고한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "figma-spec-stale-"));
  try {
    const staleDir = join(root, "wf", "screens", "STALE-01");
    const freshDir = join(root, "wf", "screens", "NOHASH-01");
    await mkdir(staleDir, { recursive: true });
    await mkdir(freshDir, { recursive: true });

    const design = (screenId, source) => ({
      schemaVersion: 1,
      screenId,
      source: { format: "JSON_REST_V1", nodeId: "1:1", rawFile: "figma.raw.json", ...source },
      viewport: { width: 10, height: 10 },
      root: { id: "1:1", type: "frame", name: screenId },
      assets: []
    });

    await writeFile(join(staleDir, "figma.raw.json"), JSON.stringify({ document: {} }), "utf8");
    await writeFile(
      join(staleDir, "figma.design.json"),
      JSON.stringify(design("STALE-01", { hash: "0".repeat(64) })),
      "utf8"
    );
    await writeFile(join(freshDir, "figma.raw.json"), JSON.stringify({ document: {} }), "utf8");
    await writeFile(
      join(freshDir, "figma.design.json"),
      JSON.stringify(design("NOHASH-01", {})),
      "utf8"
    );

    const findings = await validateSpecsRoot(root);
    assert.ok(
      findings.some(
        (finding) =>
          finding.level === "error" &&
          finding.file.includes("STALE-01") &&
          finding.message.includes("정규화")
      ),
      "hash 불일치는 정규화 재실행 오류여야 한다"
    );
    assert.ok(
      findings.some(
        (finding) =>
          finding.level === "warning" &&
          finding.file.includes("NOHASH-01") &&
          finding.message.includes("hash")
      ),
      "hash 부재는 경고여야 한다"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validateSpecsRoot는 스키마 위반과 파일 이름 불일치를 오류로 보고한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "figma-spec-validate-"));
  try {
    const wireframe = join(root, "test-wireframe");
    await mkdir(join(wireframe, "screens", "BAD-01"), { recursive: true });
    await writeFile(
      join(wireframe, "screens", "BAD-01", "screen.json"),
      JSON.stringify({
        schemaVersion: 1,
        screenId: "OTHER-ID",
        source: { pageName: "P", nodeId: "1:1", name: "BAD", figmaType: "FRAME" },
        elements: [
          {
            source: { nodeId: "9:1", name: "broken", figmaType: "FRAME" },
            spec: { type: "input", fieldKey: "broken" }
          }
        ]
      }),
      "utf8"
    );

    await writeFile(
      join(wireframe, "flows.json"),
      JSON.stringify({ schemaVersion: 1, flows: "nope" }),
      "utf8"
    );

    const findings = await validateSpecsRoot(root);
    const errors = findings.filter((finding) => finding.level === "error");
    assert.ok(
      errors.some((finding) => finding.message.includes("OTHER-ID")),
      "screenId와 파일 이름 불일치 오류가 있어야 한다"
    );
    assert.ok(
      errors.some((finding) => finding.message.includes("label")),
      "input 스키마 위반(label 누락) 오류가 있어야 한다"
    );
    assert.ok(
      errors.some((finding) => finding.file.includes("flows.json")),
      "flows.json 스키마 위반 오류가 있어야 한다"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

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

// 새 자리를 만들면 검증기가 따라와야 한다. 검사 없는 자리는 조용히 틀린 값을
// 통과시키고, 틀려도 화면이 멀쩡히 도는 값(출처 key·인자 이름)은 아무도 못 잡는다.
// MY-01 사이클에서 세 자리를 한꺼번에 열었으므로 셋 다 여기서 막는다.

function myTasksSource(overrides = {}) {
  return {
    key: "my.tasks",
    shape: "list",
    description: "내 업무",
    params: ["tab", "query"],
    fields: [{ key: "title", description: "업무 이름" }],
    ...overrides
  };
}

test("itemList가 카탈로그에 없는 조회 인자를 넘기면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", inputSpec("taskQuery")),
          element("1:3", {
            type: "itemList",
            dataSourceKey: "my.tasks",
            params: { tab: "taskQuery" }
          })
        ]
      }
    }
  ];
  const dataSources = { sources: [myTasksSource({ params: ["query"] })] };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("조회 인자 'tab'")).length,
    1
  );
});

test("itemList의 조회 인자가 없는 필드를 가리키면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:3", {
            type: "itemList",
            dataSourceKey: "my.tasks",
            params: { tab: "없는필드" }
          })
        ]
      }
    }
  ];
  const dataSources = { sources: [myTasksSource({ params: ["tab"] })] };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("'없는필드'")).length,
    1
  );
});

test("select의 개수 출처가 카탈로그에 없으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "select",
            fieldKey: "taskTab",
            placeholder: null,
            presentation: "choiceGroup",
            initialValue: "todo",
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: false,
            optionsSource: { key: "my.taskTab" },
            optionCounts: { dataSourceKey: "nope.missing" }
          })
        ]
      }
    }
  ];
  const optionSources = {
    sources: [
      {
        key: "my.taskTab",
        type: "static",
        description: "탭",
        params: [],
        options: [{ value: "todo", label: "해야 할 업무" }]
      }
    ]
  };
  const dataSources = { sources: [] };

  const findings = collectSpecFindings({ screens, optionSources, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("nope.missing")).length,
    1
  );
});

test("개수 출처가 선택지의 value를 조각으로 갖지 않으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "select",
            fieldKey: "taskTab",
            placeholder: null,
            presentation: "choiceGroup",
            initialValue: "todo",
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: false,
            optionsSource: { key: "my.taskTab" },
            optionCounts: { dataSourceKey: "my.taskTabCounts" }
          })
        ]
      }
    }
  ];
  const optionSources = {
    sources: [
      {
        key: "my.taskTab",
        type: "static",
        description: "탭",
        params: [],
        options: [
          { value: "todo", label: "해야 할 업무" },
          { value: "done", label: "완료된 업무" }
        ]
      }
    ]
  };
  const dataSources = {
    sources: [
      {
        key: "my.taskTabCounts",
        shape: "object",
        description: "탭 건수",
        params: [],
        fields: [{ key: "todo", description: "해야 할 업무 수" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, optionSources, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'done'")).length, 1);
});

test("개수 출처에 넘긴 인자가 그 출처에 없으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        params: [
          {
            key: "eventId",
            valueType: "string",
            missingNote: "어떤 행사를 볼지 정하지 않고 열렸습니다.",
            description: "어느 행사"
          }
        ],
        elements: [
          element("1:2", {
            type: "select",
            fieldKey: "documentStatus",
            placeholder: null,
            presentation: "choiceGroup",
            initialValue: "all",
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: false,
            optionsSource: { key: "doc.status" },
            optionCounts: {
              dataSourceKey: "doc.counts",
              params: { eventIdX: { screenParam: "eventId" } }
            }
          })
        ]
      }
    }
  ];
  const optionSources = {
    sources: [
      {
        key: "doc.status",
        type: "static",
        description: "문서 상태",
        params: [],
        options: [{ value: "all", label: "전체" }]
      }
    ]
  };
  const dataSources = {
    sources: [
      {
        key: "doc.counts",
        shape: "object",
        description: "문서 수",
        params: ["eventId"],
        fields: [{ key: "all", description: "전체 수" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, optionSources, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'eventIdX'")).length, 1);
});

test("표의 열이 가리킨 조각이 데이터 출처에 없으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "itemList",
            dataSourceKey: "doc.list",
            columns: [
              { label: "문서", fields: ["title"] },
              { label: "상태", fields: ["없는조각"] }
            ]
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "doc.list",
        shape: "list",
        description: "문서",
        params: [],
        fields: [
          { key: "title", description: "이름" },
          { key: "status", description: "상태" }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는조각'")).length, 1);
});

// 쪽으로 나뉜 목록은 총 몇 건인지·몇 쪽인지를 자기가 말할 수 없다. 세 자리가
// 어긋나면 쪽 버튼이 그려지긴 하는데 늘 한 쪽뿐이거나 없는 쪽으로 넘어간다.
// 이 판정은 오랫동안 **한 번도 돌지 않았다.** 딱지가 하나이던 시절의 코드가
// isObject로 물었는데 스키마는 배열이 됐고, 배열은 isObject가 아니다. 검사가
// 초록인 채로 아무것도 안 보는 것이 가장 나쁜 상태다 — 그래서 무는 것을 적어 둔다.
test("요약의 상태 딱지가 가리킨 조각이 데이터 출처에 없으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "summary",
            dataSourceKey: "req.one",
            titleField: "title",
            // 둘째 딱지가 없는 조각을 가리킨다. 딱지가 하나뿐이라고 여기면
            // 첫째만 보고 지나간다.
            status: [
              { field: "state", toneField: "stateTone" },
              { field: "없는딱지", toneField: "없는톤" }
            ],
            items: []
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "req.one",
        shape: "object",
        description: "요청 한 건",
        params: [],
        fields: [
          { key: "title", description: "이름" },
          { key: "state", description: "상태" },
          { key: "stateTone", description: "색 이름" }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는딱지'")).length, 1);
  assert.equal(findings.filter((f) => f.message.includes("'없는톤'")).length, 1);
});

// 변형은 '다른 부분만' 적는다. 그래서 바탕이 이미 말한 것을 빠뜨리기 쉽고,
// 실제로 제목에서 네 번 빠졌다 — 명세만 읽고 화면을 만들면 어느 프레임에도 없는
// 글을 제목으로 그리게 된다.
test("변형이 그리라고 한 제목이 그림에 없으면 오류다", () => {
  const design = {
    root: {
      id: "1:0",
      children: [
        { id: "1:1", text: { content: "체육대회 안전 관리 최종 회의" } },
        { id: "1:2", text: { content: "회의 종료" } }
      ]
    }
  };
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: { screenId: "S-01", meta: { title: "진행 중 회의" }, elements: [] }
    },
    {
      file: "w/screens/S-01B/screen.json",
      spec: {
        screenId: "S-01B",
        // 그림은 회의 이름을 제목으로 그리는데 명세는 이 글을 그리라고 한다.
        meta: { title: "진행 중 회의 — 진행 권한자" },
        variantOf: { screenId: "S-01", when: "진행할 수 있는 사람이 볼 때" },
        elements: []
      }
    }
  ];

  const findings = collectSpecFindings({
    screens,
    designs: { "S-01B": { file: "w/screens/S-01B/figma.design.json", design } }
  });

  assert.equal(
    findings.filter((f) => f.message.includes("그림에 그 글이 없습니다")).length,
    1
  );
});

test("그림에 있는 글을 제목으로 적은 변형은 오류가 아니다", () => {
  const design = {
    root: { id: "1:0", children: [{ id: "1:1", text: { content: "회의록 정리" } }] }
  };
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: { screenId: "S-01", meta: { title: "정리 중 회의" }, elements: [] }
    },
    {
      file: "w/screens/S-01B/screen.json",
      spec: {
        screenId: "S-01B",
        meta: { title: "회의록 정리" },
        variantOf: { screenId: "S-01", when: "정리할 수 있는 사람이 볼 때" },
        elements: []
      }
    }
  ];

  const findings = collectSpecFindings({
    screens,
    designs: { "S-01B": { file: "w/screens/S-01B/figma.design.json", design } }
  });

  assert.equal(
    findings.filter((f) => f.message.includes("그림에 그 글이 없습니다")).length,
    0
  );
});

test("쪽 인자를 목록 출처가 받지 않으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "itemList",
            dataSourceKey: "p.list",
            paging: {
              source: "1:9",
              pageParam: "page",
              dataSourceKey: "p.paging",
              totalNoteField: "totalNote",
              pageCountField: "pageCount"
            }
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "p.list",
        shape: "list",
        description: "참가자",
        params: [],
        fields: [{ key: "name", description: "이름" }]
      },
      {
        key: "p.paging",
        shape: "object",
        description: "쪽",
        params: [],
        fields: [
          { key: "totalNote", description: "총 몇 명" },
          { key: "pageCount", description: "쪽 수" }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("쪽 인자 'page'")).length,
    1
  );
});

test("쪽 번호를 params에도 적으면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "itemList",
            dataSourceKey: "p.list",
            params: { page: { value: "1" } },
            paging: {
              source: "1:9",
              pageParam: "page",
              dataSourceKey: "p.paging",
              totalNoteField: "totalNote",
              pageCountField: "없는조각"
            }
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "p.list",
        shape: "list",
        description: "참가자",
        params: ["page"],
        fields: [{ key: "name", description: "이름" }]
      },
      {
        key: "p.paging",
        shape: "object",
        description: "쪽",
        params: [],
        fields: [{ key: "totalNote", description: "총 몇 명" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  // 쪽 번호는 목록 자신이 갖는다.
  assert.equal(
    findings.filter((f) => f.message.includes("params에도 적었습니다")).length,
    1
  );
  // 쪽 수를 담은 조각이 출처에 없다.
  assert.equal(
    findings.filter((f) => f.message.includes("'없는조각'")).length,
    1
  );
});

// 선택지를 좁히는 인자도 조회 인자다. 예전에는 이 자리만 다른 모양이라 화면이
// 밖에서 받은 값을 넘길 수 없었다.
test("선택지 출처에 화면 인자를 넘길 수 있다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        params: [
          {
            key: "eventId",
            valueType: "string",
            missingNote: "어떤 행사를 볼지 정하지 않고 열렸습니다.",
            description: "어느 행사"
          }
        ],
        elements: [
          element("1:2", {
            type: "select",
            fieldKey: "affiliation",
            placeholder: "소속",
            initialValue: null,
            valueType: "string",
            required: false,
            initiallyDisabled: false,
            searchable: false,
            optionsSource: {
              key: "p.affiliations",
              params: { eventId: { screenParam: "eventId" } }
            }
          })
        ]
      }
    }
  ];
  const optionSources = {
    sources: [
      {
        key: "p.affiliations",
        type: "remote",
        description: "소속",
        params: ["eventId"],
        request: { method: "GET", path: "/x", loadOn: "open" },
        messages: { idle: "a", loading: "b", empty: "c", error: "d" }
      }
    ]
  };

  const findings = collectSpecFindings({ screens, optionSources });
  assert.deepEqual(findings, []);
});

test("한 조각이 두 열에 오면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "itemList",
            dataSourceKey: "doc.list",
            columns: [
              { label: "문서", fields: ["title"] },
              { label: "상태", fields: ["title", "status"] }
            ]
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "doc.list",
        shape: "list",
        description: "문서",
        params: [],
        fields: [
          { key: "title", description: "이름" },
          { key: "status", description: "상태" }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("둘에 옵니다")).length, 1);
});

test("itemList 항목의 이동 대상 화면이 없으면 경고다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:3", {
            type: "itemList",
            dataSourceKey: "my.tasks",
            itemAction: { type: "navigate", targetScreenId: "ZZZ-99" }
          })
        ]
      }
    }
  ];
  const dataSources = { sources: [myTasksSource()] };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter(
      (f) => f.level === "warning" && f.message.includes("ZZZ-99")
    ).length,
    1
  );
});

// 화면 셸은 화면마다 복사하지 않으려고 카탈로그로 뺐다. 그 대가로 셸이 가리키는
// 화면·데이터가 실제로 있는지는 아무 화면도 검사해 주지 않으므로 여기서 본다.
test("셸의 내비게이션이 없는 화면을 가리키면 경고다", () => {
  const shell = {
    schemaVersion: 1,
    navigation: [
      { label: "홈", targetScreenId: "S-01" },
      { label: "재정", targetScreenId: "ZZZ-99" }
    ]
  };
  const screens = [
    { file: "w/screens/S-01/screen.json", spec: { screenId: "S-01", elements: [] } }
  ];

  const findings = collectSpecFindings({ screens, shell, shellFile: "w/shell.json" });
  assert.equal(
    findings.filter((f) => f.level === "warning" && f.message.includes("ZZZ-99")).length,
    1
  );
});

test("셸이 가리킨 데이터 조각이 없으면 오류다", () => {
  const shell = {
    schemaVersion: 1,
    navigation: [{ label: "홈", targetScreenId: "S-01" }],
    viewer: { dataSourceKey: "shell.viewer", nameField: "name", roleField: "없는조각" }
  };
  const screens = [
    { file: "w/screens/S-01/screen.json", spec: { screenId: "S-01", elements: [] } }
  ];
  const dataSources = {
    sources: [
      {
        key: "shell.viewer",
        shape: "object",
        description: "보는 사람",
        params: [],
        fields: [{ key: "name", description: "이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({
    screens,
    dataSources,
    shell,
    shellFile: "w/shell.json"
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는조각'")).length, 1);
});

// title/titleField 쌍에는 검사가 있었지만 description/descriptionField를 새로
// 열면서 같은 검사가 따라오지 않았다. 새 자리마다 되풀이되는 실수라 여기서 막는다.
test("summary의 descriptionField가 없는 조각을 가리키면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "summary",
            title: "운영 공간",
            descriptionField: "없는조각",
            dataSourceKey: "ops.intro"
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "ops.intro",
        shape: "object",
        description: "안내",
        params: [],
        fields: [{ key: "description", description: "안내 문장" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는조각'")).length, 1);
});

// 칸반 열마다 status가 고정값이라 조회 인자가 화면 필드만 가리켜서는 부족하다.
// summary.items의 field(서버)/value(명세) 구분과 같은 문제라 같은 모양으로 푼다.
test("조회 인자의 고정값은 필드 참조로 검사하지 않는다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", inputSpec("taskScope")),
          element("1:3", {
            type: "itemList",
            dataSourceKey: "task.board",
            params: { scope: { fieldKey: "taskScope" }, status: { value: "planned" } }
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "task.board",
        shape: "list",
        description: "칸반",
        params: ["scope", "status"],
        fields: [{ key: "title", description: "제목" }]
      }
    ]
  };

  assert.deepEqual(collectSpecFindings({ screens, dataSources }), []);
});

test("조회 인자가 없는 필드를 가리키면 고정값과 섞여 있어도 잡는다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:3", {
            type: "itemList",
            dataSourceKey: "task.board",
            params: { scope: { fieldKey: "없는필드" }, status: { value: "planned" } }
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "task.board",
        shape: "list",
        description: "칸반",
        params: ["scope", "status"],
        fields: [{ key: "title", description: "제목" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는필드'")).length, 1);
});

// 이동 인자. 화면이 인자를 받는다면 누군가는 그 값을 줘야 하는데, 주지 않아도
// **이동은 성공한다** — 대상 화면만 조용히 빈다. 명세를 읽어서는 보이지 않는
// 종류의 구멍이라 여기서 막는다.

function boardScreens(
  itemAction,
  targetParams = [
    { key: "taskId", missingNote: "어떤 업무를 볼지 정하지 않고 열렸습니다.", description: "어느 업무" }
  ]
) {
  return [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        params: [{ key: "eventId", missingNote: "어떤 행사를 볼지 정하지 않고 열렸습니다.", description: "어느 행사" }],
        elements: [
          element("1:3", {
            type: "itemList",
            dataSourceKey: "event.taskBoard",
            params: { eventId: { screenParam: "eventId" } },
            itemAction
          })
        ]
      }
    },
    { file: "w/screens/S-02/screen.json", spec: { screenId: "S-02", params: targetParams, elements: [] } }
  ];
}

const boardSources = {
  sources: [
    {
      key: "event.taskBoard",
      shape: "list",
      description: "행사 칸반",
      params: ["eventId"],
      fields: [
        { key: "id", description: "업무를 가리키는 값" },
        { key: "title", description: "제목" }
      ]
    }
  ]
};

test("항목이 넘기는 이동 인자를 대상 화면이 받지 않으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: boardScreens({
      type: "navigate",
      targetScreenId: "S-02",
      params: { taskCode: { itemField: "id" } }
    }),
    dataSources: boardSources
  });

  assert.equal(findings.filter((f) => f.message.includes("'taskCode'를 대상 화면")).length, 1);
  // 받는 인자를 아무도 주지 않는 것도 같은 구멍이다.
  assert.equal(findings.filter((f) => f.message.includes("'taskId'를 넘기지 않습니다")).length, 1);
});

test("이동 인자가 없는 조각을 가리키면 오류다", () => {
  const findings = collectSpecFindings({
    screens: boardScreens({
      type: "navigate",
      targetScreenId: "S-02",
      params: { taskId: { itemField: "없는조각" } }
    }),
    dataSources: boardSources
  });

  assert.equal(findings.filter((f) => f.message.includes("'없는조각'")).length, 1);
});

test("제대로 넘기면 조용하다", () => {
  assert.deepEqual(
    collectSpecFindings({
      screens: boardScreens({
        type: "navigate",
        targetScreenId: "S-02",
        params: { taskId: { itemField: "id" } }
      }),
      dataSources: boardSources
    }),
    []
  );
});

test("항목이 없는 자리에서 항목의 조각을 가리키면 오류다", () => {
  // 조회하는 시점에도, 버튼을 누르는 자리에도 눌린 행이 없다.
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          element("1:2", {
            type: "button",
            label: "이동",
            action: {
              type: "navigate",
              targetScreenId: "S-02",
              params: { taskId: { itemField: "id" } }
            }
          }),
          element("1:3", {
            type: "itemList",
            dataSourceKey: "event.taskBoard",
            params: { eventId: { itemField: "id" } }
          })
        ]
      }
    },
    { file: "w/screens/S-02/screen.json", spec: { screenId: "S-02", elements: [] } }
  ];

  const findings = collectSpecFindings({ screens, dataSources: boardSources });
  assert.equal(findings.filter((f) => f.message.includes("눌린 항목이 없습니다")).length, 1);
  assert.equal(findings.filter((f) => f.message.includes("아직 항목이 없습니다")).length, 1);
});

test("이동하지 않는 동작은 인자를 나를 수 없다", () => {
  const findings = collectSpecFindings({
    screens: boardScreens({
      type: "pending",
      note: "아직",
      params: { taskId: { itemField: "id" } }
    }),
    dataSources: boardSources
  });

  assert.equal(findings.filter((f) => f.message.includes("받을 화면이 없습니다")).length, 1);
});

// 제목이 데이터에서 오는 화면. 요소가 아니라 화면 자체가 값을 읽으므로 요소
// 검사가 지나친다 — 지나치면 없는 조각을 가리켜도 제목만 조용히 빈다.
test("화면 제목의 출처와 조각을 검사한다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        params: [{ key: "eventId", missingNote: "어떤 행사를 볼지 정하지 않고 열렸습니다.", description: "어느 행사" }],
        meta: {
          title: "행사 업무",
          titleFrom: {
            dataSourceKey: "event.summary",
            field: "없는조각",
            params: { eventId: { screenParam: "없는인자" } }
          }
        },
        elements: []
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "event.summary",
        shape: "object",
        description: "행사 카드",
        params: ["eventId"],
        fields: [{ key: "title", description: "행사 이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는조각'")).length, 1);
  assert.equal(findings.filter((f) => f.message.includes("'없는인자'")).length, 1);
});

test("제목의 출처가 목록이면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        meta: { title: "행사 업무", titleFrom: { dataSourceKey: "event.list", field: "title" } },
        elements: []
      }
    }
  ];
  const dataSources = {
    sources: [
      {
        key: "event.list",
        shape: "list",
        description: "행사 목록",
        params: [],
        fields: [{ key: "title", description: "행사 이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("object여야 합니다")).length, 1);
});

// --- 되풀이되는 항목의 칸 ---------------------------------------------------

function listScreen(listSpec, extra = {}) {
  return [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          {
            source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
            spec: {
              type: "list",
              fieldKey: "items",
              itemNoun: "품목",
              addLabel: "품목 추가",
              minItems: 1,
              maxItems: 10,
              itemActions: [],
              ...listSpec
            }
          },
          ...(extra.elements ?? [])
        ],
        ...(extra.screen ?? {})
      }
    }
  ];
}

const ITEM_FIELD = {
  source: { nodeId: "1:2", name: "Input", figmaType: "FRAME" },
  spec: {
    type: "input",
    fieldKey: "quantity",
    label: "수량",
    placeholder: null,
    initialValue: null,
    inputType: "number",
    valueType: "integer",
    required: true,
    validation: []
  }
};

test("항목의 칸이 있으면 머리에 그릴 이름도 있어야 한다", () => {
  const findings = collectSpecFindings({
    screens: listScreen({ itemFields: [ITEM_FIELD] })
  });
  assert.equal(findings.filter((f) => f.message.includes("itemTitleFieldKey가 없습니다")).length, 1);
});

test("항목 머리의 이름은 항목의 칸을 가리켜야 한다", () => {
  const findings = collectSpecFindings({
    screens: listScreen({ itemTitleFieldKey: "없는칸", itemFields: [ITEM_FIELD] })
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는칸'")).length, 1);
});

test("항목의 칸이 있으면 이름 고치기는 칸을 고치는 것이다", () => {
  const findings = collectSpecFindings({
    screens: listScreen({
      itemActions: ["rename"],
      itemTitleFieldKey: "quantity",
      itemFields: [ITEM_FIELD]
    })
  });
  assert.equal(findings.filter((f) => f.message.includes("'rename'을 쓸 수 없습니다")).length, 1);
});

test("항목의 칸도 화면의 요소와 같은 검사를 받는다", () => {
  // 항목 안의 드롭다운이 없는 선택지 출처를 가리킨다. 펴 두지 않으면 조용히 지나간다.
  const findings = collectSpecFindings({
    screens: listScreen({
      itemTitleFieldKey: "quantity",
      itemFields: [
        ITEM_FIELD,
        {
          source: { nodeId: "1:3", name: "Input", figmaType: "FRAME" },
          spec: {
            type: "select",
            fieldKey: "category",
            placeholder: null,
            initialValue: null,
            valueType: "string",
            required: true,
            initiallyDisabled: false,
            searchable: false,
            optionsSource: { key: "없는출처" }
          }
        }
      ]
    }),
    optionSources: { sources: [] }
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는출처'")).length, 1);
});

// 겹이 하나 더 깊어도 같은 검사를 받는다. **깊이가 자란 것을 훑는 법이
// 따라가지 못했다** — 목록 안의 목록에 담긴 요소 아홉(EVT-01·EVT-03A·EVT-03B·
// ORG-03A·ORG-03B의 부원 카드)이 스키마 재검증과 출처 조각 검사에서 통째로
// 빠져 있었고, 없는 조각을 가리켜도 오류 0건이었다.
test("두 겹 아래의 칸도 화면의 요소와 같은 검사를 받는다", () => {
  const findings = collectSpecFindings({
    screens: listScreen({
      itemTitleFieldKey: "quantity",
      itemFields: [
        ITEM_FIELD,
        {
          source: { nodeId: "1:4", name: "List", figmaType: "FRAME" },
          spec: {
            type: "list",
            title: "안쪽 목록",
            addLabel: "더하기",
            itemTitleFieldKey: "quantity",
            itemFields: [
              {
                source: { nodeId: "1:5", name: "Input", figmaType: "FRAME" },
                spec: {
                  type: "select",
                  fieldKey: "deepCategory",
                  placeholder: null,
                  initialValue: null,
                  valueType: "string",
                  required: true,
                  initiallyDisabled: false,
                  searchable: false,
                  optionsSource: { key: "두겹아래없는출처" }
                }
              }
            ]
          }
        }
      ]
    }),
    optionSources: { sources: [] }
  });
  assert.equal(
    findings.filter((f) => f.message.includes("'두겹아래없는출처'")).length,
    1
  );
});

// 비었을 때 권하는 단추도 화면을 옮긴다. 세 자리(action·itemAction·
// selection.action)만 보던 동안 EVT-03A의 '운영 조직 구성하기'는 어느 게이트도
// 확인하지 않았다 - 넘기는 인자가 대상 화면이 받는 것인지조차.
test("빈 상태의 단추가 넘기는 인자도 대상 화면이 받아야 한다", () => {
  const findings = collectSpecFindings({
    screens: listScreen({
      itemTitleFieldKey: "quantity",
      itemFields: [ITEM_FIELD],
      emptyAction: {
        type: "navigate",
        label: "만들러 가기",
        targetScreenId: "S-02",
        params: { 없는인자: { value: "x" } }
      }
    }).concat([
      {
        file: "w/screens/S-02/screen.json",
        spec: { screenId: "S-02", elements: [] }
      }
    ])
  });
  assert.equal(
    findings.filter((f) => f.message.includes("'없는인자'")).length,
    1
  );
});

// --- 화면이 스스로 셈하는 값 -------------------------------------------------

function summaryScreen(items, extra = {}) {
  return listScreen(
    { itemTitleFieldKey: "quantity", itemFields: [ITEM_FIELD] },
    {
      elements: [
        {
          source: { nodeId: "1:9", name: "Container", figmaType: "FRAME" },
          spec: { type: "summary", items }
        }
      ],
      ...extra
    }
  );
}

test("셈이 가리킨 목록이 없으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: summaryScreen([
      { label: "총 품목 수", compute: { op: "count", listFieldKey: "없는목록" } }
    ])
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는목록'")).length, 1);
});

test("항목 밖에서는 곱할 것이 없다", () => {
  const findings = collectSpecFindings({
    screens: summaryScreen([
      { label: "품목 총액", compute: { op: "product", fieldKeys: ["quantity"] } }
    ])
  });
  assert.equal(
    findings.filter((f) => f.message.includes("항목 안에 있지 않습니다")).length,
    1
  );
});

test("곱하려는 칸이 항목에 없으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: summaryScreen([
      {
        label: "전체 예상 금액",
        compute: { op: "sum", listFieldKey: "items", fieldKeys: ["quantity", "없는칸"] }
      }
    ])
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는칸'")).length, 1);
});

test("세는 것은 항목이지 칸이 아니다", () => {
  const findings = collectSpecFindings({
    screens: summaryScreen([
      { label: "총 품목 수", compute: { op: "count", listFieldKey: "items", fieldKeys: ["quantity"] } }
    ])
  });
  assert.equal(findings.filter((f) => f.message.includes("세는 것은 항목이지")).length, 1);
});

test("요약이 되비추는 칸이 화면에 없으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: summaryScreen([{ label: "우선순위", fieldKey: "없는칸" }])
  });
  assert.equal(findings.filter((f) => f.message.includes("'없는칸'")).length, 1);
});

// --- 고칠 것을 먼저 읽어 오는 화면 -------------------------------------------

test("초안 출처의 조각을 받을 칸이 없으면 오류다", () => {
  const screens = listScreen(
    { itemTitleFieldKey: "quantity", itemFields: [ITEM_FIELD] },
    { screen: { draftFrom: { dataSourceKey: "req.draft" } } }
  );
  const dataSources = {
    sources: [
      {
        key: "req.draft",
        shape: "object",
        description: "요청 한 건",
        params: [],
        fields: [
          { key: "items", description: "품목", fields: [{ key: "quantity", description: "수량" }] },
          { key: "쓰이지않는조각", description: "아무도 안 받는다" }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'쓰이지않는조각'")).length, 1);
});

test("목록의 칸이 초안 출처에 없으면 오류다", () => {
  const screens = listScreen(
    { itemTitleFieldKey: "quantity", itemFields: [ITEM_FIELD] },
    { screen: { draftFrom: { dataSourceKey: "req.draft" } } }
  );
  const dataSources = {
    sources: [
      {
        key: "req.draft",
        shape: "object",
        description: "요청 한 건",
        params: [],
        fields: [
          { key: "items", description: "품목", fields: [{ key: "다른칸", description: "딴것" }] }
        ]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("칸 'quantity'가 초안 출처")).length, 1);
});

test("없어도 되는 인자는 넘기지 않아도 되지만, 넘기면 받는다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [
          {
            source: { nodeId: "1:1", name: "Btn", figmaType: "FRAME" },
            spec: {
              type: "button",
              label: "새로 쓰기",
              initiallyDisabled: false,
              action: {
                type: "navigate",
                targetScreenId: "S-02",
                params: { eventId: { value: "E-01" } }
              }
            }
          }
        ]
      }
    },
    {
      file: "w/screens/S-02/screen.json",
      spec: {
        screenId: "S-02",
        params: [
          { key: "eventId", missingNote: "어떤 행사를 볼지 정하지 않고 열렸습니다.", description: "어느 행사" },
          { key: "requestId", optional: true, description: "고칠 요청. 없으면 새로 쓴다" }
        ],
        elements: []
      }
    }
  ];

  const findings = collectSpecFindings({ screens });
  assert.equal(findings.filter((f) => f.message.includes("'requestId'")).length, 0);
});

// 인자가 없을 때 뭐라고 할지를 명세가 갖지 않으면 구현이 지어낸다. 실제로 그랬다:
// 어떤 화면은 '이 화면은 eventId가 있어야 열립니다'라고 썼고, 다른 화면은 명세의
// 내부 설명을 그대로 사람에게 뿌렸다. 둘 다 명세에 없는 카피다.
test("없으면 안 되는 인자는 없을 때 뭐라고 할지를 갖는다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          params: [{ key: "eventId", description: "어느 행사" }],
          elements: []
        }
      }
    ]
  });

  assert.equal(findings.filter((f) => f.message.includes("missingNote")).length, 1);
});

test("없어도 되는 인자는 없을 때의 글을 갖지 않는다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          params: [
            {
              key: "requestId",
              optional: true,
              missingNote: "그릴 일이 없는 글",
              description: "없으면 새로 쓴다"
            }
          ],
          elements: []
        }
      }
    ]
  });

  assert.equal(findings.filter((f) => f.message.includes("missingNote")).length, 1);
});

// 딱지의 색 이름은 그려지는 글이 아니다. 이것을 명세가 가리키지 않던 동안
// 화면들은 row.statusTone을 코드에 박아 썼고, 출처의 조각 이름이 바뀌어도
// 검증기가 아무 말도 하지 못했다.
test("열이 가리킨 색 이름 조각이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: {
                type: "itemList",
                dataSourceKey: "req.items",
                columns: [{ label: "처리 결과", fields: ["result"], toneField: "resultTone" }]
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "req.items",
          shape: "list",
          fields: [{ key: "result", label: "처리 결과" }]
        }
      ]
    }
  });

  assert.equal(findings.filter((f) => f.message.includes("'resultTone'")).length, 1);
});

test("색 이름 조각이 열에도 그려지면 오류다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: {
                type: "itemList",
                dataSourceKey: "req.items",
                columns: [
                  { label: "처리 결과", fields: ["result"], toneField: "resultTone" },
                  { label: "색", fields: ["resultTone"] }
                ]
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "req.items",
          shape: "list",
          fields: [
            { key: "result", label: "처리 결과" },
            { key: "resultTone", label: "색 이름" }
          ]
        }
      ]
    }
  });

  assert.equal(
    findings.filter((f) => f.message.includes("어느 열에도 오지 않습니다")).length,
    1
  );
});

// 경로의 글은 디자인이 그려 두었지만, 데이터에서 오는 조각은 명세가 가리킨다.
test("현재 위치 경로가 출처 없이 조각을 가리키면 오류다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          breadcrumb: {
            source: "1:9",
            items: [{ value: "운영" }, { field: "eventName" }]
          },
          elements: []
        }
      }
    ]
  });

  assert.equal(findings.filter((f) => f.message.includes("'eventName'")).length, 1);
});

test("현재 위치 경로가 가리킨 조각이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          breadcrumb: {
            source: "1:9",
            dataSourceKey: "req.detail",
            items: [{ value: "운영" }, { field: "eventName" }]
          },
          elements: []
        }
      }
    ],
    dataSources: {
      sources: [{ key: "req.detail", shape: "object", fields: [{ key: "code", label: "번호" }] }]
    }
  });

  assert.equal(findings.filter((f) => f.message.includes("'eventName'")).length, 1);
});

// 묶음으로 오는 목록. 열은 묶음 **안**의 항목을 말하고, 머리는 묶음 자신을 말한다.
// 이 둘을 가르지 않으면 열이 전부 '없는 조각'으로 보인다.
function groupedScreen(itemList) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: { type: "itemList", dataSourceKey: "po.list", ...itemList }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "po.list",
          shape: "list",
          fields: [
            { key: "vendor", label: "업체" },
            { key: "orderNote", label: "주문" },
            {
              key: "items",
              label: "품목들",
              fields: [
                { key: "name", label: "품목" },
                { key: "orderStatus", label: "주문 상태" },
                { key: "orderStatusTone", label: "색" }
              ]
            }
          ]
        }
      ]
    }
  };
}

test("묶음이 있으면 열은 묶음 안의 조각을 가리킨다", () => {
  const findings = collectSpecFindings(
    groupedScreen({
      group: { itemsField: "items", headerFields: [{ fields: ["vendor", "orderNote"] }] },
      columns: [{ label: "품목", fields: ["name"] }, { label: "주문 상태", fields: ["orderStatus"], toneField: "orderStatusTone" }]
    })
  );

  assert.deepEqual(findings, []);
});

test("묶음의 머리가 안쪽 조각을 가리키면 오류다", () => {
  const findings = collectSpecFindings(
    groupedScreen({
      group: { itemsField: "items", headerFields: [{ fields: ["name"] }] },
      columns: [{ label: "품목", fields: ["name"] }]
    })
  );

  assert.equal(findings.filter((f) => f.message.includes("묶음 머리")).length, 1);
});

test("묶음 조각에 fields가 없으면 오류다", () => {
  const findings = collectSpecFindings(
    groupedScreen({
      group: { itemsField: "vendor" },
      columns: [{ label: "품목", fields: ["name"] }]
    })
  );

  assert.equal(findings.filter((f) => f.message.includes("fields가 없습니다")).length, 1);
});

// 안쪽 목록의 제목이 바깥 항목에서 온다면(titleField) 그 조각이 실제로 있어야 한다.
// 없으면 제목만 빈 채로 그려지고 아무도 말하지 않는다 — 조직도의 '부원 2명'이
// 그 자리다.
function nestedTitleScreen(nested) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: {
                type: "itemList",
                dataSourceKey: "org.departments",
                itemFields: [
                  {
                    source: { nodeId: "1:2", name: "Container", figmaType: "FRAME" },
                    spec: { type: "itemList", itemsField: "members", ...nested }
                  }
                ]
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "org.departments",
          shape: "list",
          fields: [
            { key: "memberCountLabel", label: "부원 수" },
            { key: "members", label: "부원들", fields: [{ key: "name", label: "이름" }] }
          ]
        }
      ]
    }
  };
}

test("안쪽 목록의 제목이 바깥 항목의 조각을 가리키면 조용하다", () => {
  const findings = collectSpecFindings(
    nestedTitleScreen({
      titleField: "memberCountLabel",
      columns: [{ label: "이름", fields: ["name"] }]
    })
  );

  assert.deepEqual(findings, []);
});

test("안쪽 목록의 제목이 없는 조각을 가리키면 오류다", () => {
  const findings = collectSpecFindings(
    nestedTitleScreen({
      titleField: "없는조각",
      columns: [{ label: "이름", fields: ["name"] }]
    })
  );

  assert.equal(
    findings.filter((f) => f.message.includes("제목이 가리킨 조각")).length,
    1
  );
});

test("안쪽 목록의 제목이 안쪽 조각을 가리키면 오류다", () => {
  // 제목은 목록 **위**에 붙으므로 바깥 항목의 것이다. 안쪽 항목의 조각을
  // 가리키면 어느 항목의 값인지 정할 수 없다.
  const findings = collectSpecFindings(
    nestedTitleScreen({ titleField: "name", columns: [{ label: "이름", fields: ["name"] }] })
  );

  assert.equal(
    findings.filter((f) => f.message.includes("제목이 가리킨 조각")).length,
    1
  );
});

// 옮길 수 있는 목록은 자리를 잃은 사람이 어디 모이는지를 가리킨다.
function movableScreen(itemMove, extraSources = []) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: { type: "itemList", dataSourceKey: "org.executives", itemMove }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        { key: "org.executives", shape: "list", fields: [{ key: "name", label: "이름" }] },
        ...extraSources
      ]
    }
  };
}

test("미배정 출처가 있는 목록이면 조용하다", () => {
  const findings = collectSpecFindings(
    movableScreen(
      { poolSourceKey: "org.unassigned", releaseLabel: "이 자리에서 빼기" },
      [{ key: "org.unassigned", shape: "list", fields: [{ key: "name", label: "이름" }] }]
    )
  );

  assert.deepEqual(findings, []);
});

test("미배정 출처가 카탈로그에 없으면 오류다", () => {
  const findings = collectSpecFindings(
    movableScreen({ poolSourceKey: "org.없음", releaseLabel: "빼기" })
  );

  assert.equal(
    findings.filter((f) => f.message.includes("미배정 출처")).length,
    1
  );
});

test("미배정 출처가 목록이 아니면 오류다", () => {
  // 자리 없는 사람은 여럿일 수 있다. 값 묶음 하나로는 담기지 않는다.
  const findings = collectSpecFindings(
    movableScreen(
      { poolSourceKey: "org.count", releaseLabel: "빼기" },
      [{ key: "org.count", shape: "object", fields: [{ key: "total", label: "수" }] }]
    )
  );

  assert.equal(
    findings.filter((f) => f.message.includes("목록이어야 합니다")).length,
    1
  );
});

// 줄 전체의 색 이름도 실제로 있는 조각이어야 한다. 없으면 아무 줄도 표시되지
// 않고 아무도 말하지 않는다 — 학생 명단의 '확인 필요' 줄이 그 자리다.
function rowTonedScreen(rowToneField) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: {
                type: "itemList",
                dataSourceKey: "org.students",
                rowToneField,
                columns: [{ label: "이름", fields: ["name"] }]
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "org.students",
          shape: "list",
          fields: [
            { key: "name", label: "이름" },
            { key: "rowTone", label: "줄 색" }
          ]
        }
      ]
    }
  };
}

test("줄 색 이름이 출처에 있으면 조용하다", () => {
  assert.deepEqual(collectSpecFindings(rowTonedScreen("rowTone")), []);
});

test("줄 색 이름이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings(rowTonedScreen("없는조각"));

  assert.equal(
    findings.filter((f) => f.message.includes("줄 색 이름 조각")).length,
    1
  );
});

// 받아 가는 것도 실제로 있는 조각을 가리켜야 한다. pending으로 적으면 '아직
// 안 정했다'는 뜻이 되어 조용한 대체가 되므로, 이 어휘가 생긴 김에 그 참조를
// 아무도 안 보는 자리로 두면 안 된다.
function downloadingScreen(downloadField, downloadSourceKey = "meeting.minutes") {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Btn", figmaType: "FRAME" },
              spec: {
                type: "button",
                label: "회의록 내보내기",
                initiallyDisabled: false,
                action: { type: "download", downloadField, downloadSourceKey }
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "meeting.minutes",
          shape: "object",
          fields: [{ key: "exportName", label: "내보낼 파일" }]
        }
      ]
    }
  };
}

// 집어 가는 것에는 **검사가 있는데 계약 검사가 없었다.** 그래서 그 검사가
// itemList 가지에 걸려 실제 명세에서 한 번도 돌지 않은 것을 아무도 몰랐다
// (진짜 copy 단추는 ORG-03C의 button 둘이다). 이제 여기서 돈다.
function copyingScreen(copyField, copySourceKey = "org.invite") {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Btn", figmaType: "FRAME" },
              spec: {
                type: "button",
                label: "링크 복사",
                initiallyDisabled: false,
                action: { type: "copy", copyField, copySourceKey }
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "org.invite",
          shape: "object",
          fields: [{ key: "url", label: "초대 링크" }]
        }
      ]
    }
  };
}

// 줄마다 가는 곳이 다른 목록. 데이터가 화면 id를 직접 주면 검증기가 확인할 수
// 없으므로, 데이터는 열쇠만 주고 갈 곳은 명세가 든다 - 그래서 여기서 볼 수 있다.
function branchingScreen(targets) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
              spec: {
                type: "itemList",
                dataSourceKey: "meeting.rows",
                columns: [{ label: "이름", fields: ["title"] }],
                itemAction: { type: "navigate", targetField: "kind", targets }
              }
            }
          ]
        }
      },
      { file: "w/screens/S-02/screen.json", spec: { screenId: "S-02", elements: [] } }
    ],
    dataSources: {
      sources: [
        {
          key: "meeting.rows",
          shape: "list",
          fields: [
            { key: "title", label: "이름" },
            { key: "kind", label: "어느 상세로" }
          ]
        }
      ]
    }
  };
}

// 보내고 나면 어디로 가는지가 정해졌는지 아닌지. 비어 있으면 '머문다'는 뜻이고
// note가 있으면 '아직 안 정했다'다. 둘을 함께 적으면 무슨 뜻인지 알 수 없다.
function submittingScreen(onSuccess) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          stateScopeKey: "draft",
          elements: [
            {
              source: { nodeId: "1:1", name: "Btn", figmaType: "FRAME" },
              spec: {
                type: "button",
                label: "보내기",
                initiallyDisabled: false,
                action: { type: "submit", mutationKey: "w.send", onSuccess }
              }
            }
          ]
        }
      }
    ],
    mutations: {
      mutations: [
        {
          key: "w.send",
          description: "보낸다",
          request: { method: "POST", path: "/api/w" },
          payloadScope: "draft",
          messages: { submitting: "보내는 중입니다", error: "보내지 못했습니다" }
        }
      ]
    },
    stateScopes: {
      scopes: [
        { key: "draft", description: "초안", lifetime: "flow", clearOn: ["complete"] }
      ]
    }
  };
}

// 이 화면을 누가 보는가. 겹쳐 뜨는 화면은 이 값을 갖지 않는다 — 뒤에 남는
// 화면이 이미 말했다.
test("겹쳐 뜨는 화면은 보는 사람을 따로 말하지 않는다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: { screenId: "S-01", elements: [] }
      },
      {
        file: "w/screens/S-02/screen.json",
        spec: {
          screenId: "S-02",
          viewer: "external",
          overlay: { screenId: "S-01", source: "1:1" },
          elements: []
        }
      }
    ]
  });

  assert.equal(
    findings.filter((f) => f.message.includes("겹쳐 뜨는 화면")).length,
    1
  );
});

// 셸의 메뉴도 같다. 겹치는 화면은 뒤에 남는 화면을 그리게 하고 그 화면이 셸을
// 그린다 - 겹치는 쪽이 적어 두면 아무도 읽지 않는 값이 명세에 남는다.
test("겹쳐 뜨는 화면은 셸의 메뉴를 따로 말하지 않는다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          activeNavigationScreenId: "OPS-00",
          elements: []
        }
      },
      {
        file: "w/screens/S-02/screen.json",
        spec: {
          screenId: "S-02",
          activeNavigationScreenId: "OPS-00",
          overlay: { screenId: "S-01", source: "1:1" },
          elements: []
        }
      }
    ]
  });

  assert.equal(
    findings.filter((f) => f.message.includes("activeNavigationScreenId")).length,
    1
  );
});

test("보내고 머문다고 말하면 조용하다", () => {
  assert.deepEqual(collectSpecFindings(submittingScreen({})), []);
});

test("어디로 가는지 아직 안 정했다고 적어도 조용하다", () => {
  assert.deepEqual(
    collectSpecFindings(submittingScreen({ note: "보낸 뒤 어디로 가는지가 디자인에 없습니다." })),
    []
  );
});

test("갈 곳과 '아직 안 정했다'를 함께 적으면 오류다", () => {
  const findings = collectSpecFindings(
    submittingScreen({ navigate: "S-01", note: "아직 정해지지 않았습니다." })
  );

  assert.ok(findings.some((f) => f.level === "error"));
});

test("갈림길이 가리킨 화면이 모두 있으면 조용하다", () => {
  assert.deepEqual(
    collectSpecFindings(
      branchingScreen([
        { value: "a", targetScreenId: "S-01" },
        { value: "b", targetScreenId: "S-02" }
      ])
    ),
    []
  );
});

test("갈림길이 없는 화면을 가리키면 알린다", () => {
  const findings = collectSpecFindings(
    branchingScreen([
      { value: "a", targetScreenId: "S-02" },
      { value: "b", targetScreenId: "S-없음" }
    ])
  );

  assert.equal(findings.filter((f) => f.message.includes("갈림길이 가리킨 화면")).length, 1);
});

test("집어 가려는 조각이 출처에 있으면 조용하다", () => {
  assert.deepEqual(collectSpecFindings(copyingScreen("url")), []);
});

test("집어 가려는 조각이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings(copyingScreen("없는조각"));

  assert.equal(
    findings.filter((f) => f.message.includes("가져가려는 조각")).length,
    1
  );
});

test("집어 가려는 출처가 카탈로그에 없으면 오류다", () => {
  const findings = collectSpecFindings(copyingScreen("url", "org.없는출처"));

  assert.equal(
    findings.filter((f) => f.message.includes("가져가려는 출처")).length,
    1
  );
});

test("받아 가려는 조각이 출처에 있으면 조용하다", () => {
  assert.deepEqual(collectSpecFindings(downloadingScreen("exportName")), []);
});

test("받아 가려는 조각이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings(downloadingScreen("없는조각"));

  assert.equal(
    findings.filter((f) => f.message.includes("받아 가려는 조각")).length,
    1
  );
});

test("받아 가려는 출처가 카탈로그에 없으면 오류다", () => {
  const findings = collectSpecFindings(
    downloadingScreen("exportName", "meeting.없는출처")
  );

  assert.equal(
    findings.filter((f) => f.message.includes("받아 가려는 출처")).length,
    1
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
