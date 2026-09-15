import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";
import { validateSpecsRoot } from "../apps/spec-service/src/validate-specs.mjs";
import { element, myTasksSource } from "./spec-validation-fixtures.mjs";

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
      params: [{ key: "eventId", required: false, valueType: "string", description: "eventId" }],
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
// 지금 보고 있는 자리(action.type: current). **갈 곳도 보낼 것도 note도 없다.**
//
// 이 어휘가 생기기 전에는 네 자리가 pending을 빌려 쓰면서 note에 '지금 보고 있는
// 갈피입니다'라고 적었다 — pending은 '아직 명세되지 않았다'로 못 박은 말이라
// 정반대의 뜻이었고, 명세를 읽는 사람은 '아직 안 만들었구나'로 읽었다.
function currentTabScreen(extra) {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          schemaVersion: 1,
          screenId: "S-01",
          source: { pageName: "P", nodeId: "1:1", name: "S", figmaType: "FRAME" },
          elements: [
            {
              source: { nodeId: "9:1", name: "Btn", figmaType: "FRAME" },
              spec: {
                type: "button",
                label: "운영 조직",
                emphasis: "quiet",
                initiallyDisabled: true,
                action: { type: "current", ...extra }
              }
            }
          ]
        }
      }
    ]
  };
}

test("지금 보고 있는 자리는 갈 곳을 갖지 않는다", async () => {
  const root = await mkdtemp(join(tmpdir(), "figma-spec-current-"));
  try {
    const wireframe = join(root, "test-wireframe");
    await mkdir(join(wireframe, "screens", "S-01"), { recursive: true });
    const write = (extra) =>
      writeFile(
        join(wireframe, "screens", "S-01", "screen.json"),
        JSON.stringify(currentTabScreen(extra).screens[0].spec),
        "utf8"
      );

    await write({});
    const clean = await validateSpecsRoot(root);
    assert.equal(
      clean.filter((f) => f.level === "error" && f.message.includes("스키마 위반")).length,
      0,
      "아무 조각도 없는 current는 조용해야 한다"
    );

    for (const extra of [{ targetScreenId: "S-01" }, { note: "아직" }]) {
      await write(extra);
      const findings = await validateSpecsRoot(root);
      assert.ok(
        findings.some(
          (f) => f.level === "error" && f.message.includes("스키마 위반")
        ),
        `current에 ${Object.keys(extra)[0]}를 붙이면 오류여야 한다`
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
