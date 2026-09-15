import assert from "node:assert/strict";
import { test } from "node:test";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";
import { element, inputSpec, myTasksSource } from "./spec-validation-fixtures.mjs";

// 새 자리를 만들면 검증기가 따라와야 한다. 검사 없는 자리는 조용히 틀린 값을
// 통과시키고, 틀려도 화면이 멀쩡히 도는 값(출처 key·인자 이름)은 아무도 못 잡는다.
// MY-01 사이클에서 세 자리를 한꺼번에 열었으므로 셋 다 여기서 막는다.

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
  const dataSources = { sources: [myTasksSource({ params: [{ key: "query", required: false, valueType: "string", description: "query" }] })] };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("조회 인자 'tab'")).length,
    1
  );
});

// **열쇠를 빠뜨리면 전부가 온다.**
//
// 인자 이름이 틀린 것은 이미 잡고 있었다. 그런데 아예 안 넘긴 것은 조용했다 —
// 서버는 거르지 않은 목록을 주고 화면은 그것이 걸러진 것인 줄 알고 그린다.
// 남의 것이 섞여 그려지는데 빨간불이 없다.
test("반드시 넘겨야 하는 조회 인자를 빠뜨리면 오류다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        params: [{ key: "eventId", missingNote: "행사를 정하지 않고 열렸습니다.", description: "어느 행사" }],
        elements: [
          element("1:3", {
            type: "itemList",
            dataSourceKey: "my.tasks",
            params: {}
          })
        ]
      }
    }
  ];
  const dataSources = {
    sources: [
      myTasksSource({
        params: [{ key: "eventId", required: true, valueType: "string", description: "어느 행사인가" }]
      })
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(
    findings.filter((f) => f.message.includes("반드시 넘겨야 하는 인자 'eventId'")).length,
    1
  );
});

// 없어도 되는 인자는 안 넘겨도 조용해야 한다. 그러지 않으면 거르개를 쓸 때마다
// 빨간불이 뜨고, 뜨는 빨간불은 곧 무시된다.
test("없어도 되는 조회 인자는 빠뜨려도 조용하다", () => {
  const screens = [
    {
      file: "w/screens/S-01/screen.json",
      spec: {
        screenId: "S-01",
        elements: [element("1:3", { type: "itemList", dataSourceKey: "my.tasks", params: {} })]
      }
    }
  ];
  const dataSources = { sources: [myTasksSource()] };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.deepEqual(findings, []);
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
  const dataSources = { sources: [myTasksSource({ params: [{ key: "tab", required: false, valueType: "string", description: "tab" }] })] };

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
        params: [{ key: "eventId", required: false, valueType: "string", description: "eventId" }],
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
        params: [{ key: "page", required: false, valueType: "string", description: "page" }],
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
        params: [{ key: "eventId", required: false, valueType: "string", description: "eventId" }],
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
        params: [{ key: "scope", required: false, valueType: "string", description: "scope" }, { key: "status", required: false, valueType: "string", description: "status" }],
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
        params: [{ key: "scope", required: false, valueType: "string", description: "scope" }, { key: "status", required: false, valueType: "string", description: "status" }],
        fields: [{ key: "title", description: "제목" }]
      }
    ]
  };

  const findings = collectSpecFindings({ screens, dataSources });
  assert.equal(findings.filter((f) => f.message.includes("'없는필드'")).length, 1);
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
        params: [{ key: "eventId", required: false, valueType: "string", description: "eventId" }],
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
// 데이터가 허락할 때만 그리는 자리(drawnWhen). **검사가 실제로 도는지**를 여기서
// 못 박는다 — 이 저장소에서 한 번도 돈 적 없는 검사가 둘 있었고, 둘 다 계약
// 검사가 없어 아무도 몰랐다.
function conditionalScreen(field, dataSourceKey = "attendance.checkInResult") {
  return {
    screens: [
      {
        file: "w/screens/S-01/screen.json",
        spec: {
          screenId: "S-01",
          elements: [
            {
              addedByDecision: {
                decision: "사람이 두기로 정했다",
                why: "그림에 없다"
              },
              drawnWhen: { dataSourceKey, field },
              spec: {
                type: "button",
                label: "다시 입력",
                initiallyDisabled: false,
                action: { type: "navigate", targetScreenId: "S-01" }
              }
            }
          ]
        }
      }
    ],
    dataSources: {
      sources: [
        {
          key: "attendance.checkInResult",
          shape: "object",
          fields: [{ key: "canRetry", label: "다시 낼 수 있는가" }]
        }
      ]
    }
  };
}

test("데이터가 허락하는 조각이 출처에 있으면 조용하다", () => {
  assert.deepEqual(collectSpecFindings(conditionalScreen("canRetry")), []);
});

test("데이터가 허락하는 조각이 출처에 없으면 오류다", () => {
  const findings = collectSpecFindings(conditionalScreen("없는조각"));

  assert.equal(
    findings.filter((f) => f.message.includes("drawnWhen이 가리킨 조각")).length,
    1
  );
});

test("데이터가 허락하는 출처가 카탈로그에 없으면 오류다", () => {
  const findings = collectSpecFindings(
    conditionalScreen("canRetry", "attendance.없는출처")
  );

  assert.equal(
    findings.filter((f) => f.message.includes("데이터 출처")).length,
    1
  );
});
