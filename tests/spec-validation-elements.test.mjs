import assert from "node:assert/strict";
import { test } from "node:test";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";

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
