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
          children: [
            { id: "9:1", type: "frame", name: "name" },
            { id: "9:5", type: "frame", name: "다음" },
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
