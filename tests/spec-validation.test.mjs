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
