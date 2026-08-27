import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateButtonExecution,
  getRequiredFieldCandidates
} from "../packages/contracts/src/button-execution.mjs";

const elements = [
  {
    spec: {
      type: "input",
      fieldKey: "name",
      label: "이름",
      required: true
    }
  },
  {
    spec: {
      type: "input",
      fieldKey: "studentNumber",
      label: "학번",
      required: true
    }
  },
  {
    spec: {
      type: "input",
      fieldKey: "nickname",
      label: "별명",
      required: false
    }
  },
  {
    spec: {
      type: "select",
      fieldKey: "school",
      label: "학교",
      required: true
    }
  },
  {
    spec: {
      type: "select",
      fieldKey: "college",
      label: "단과대학",
      required: true,
      initiallyDisabled: true,
      enabledWhen: [{ fieldKey: "school", operator: "hasValue" }]
    }
  },
  {
    spec: {
      type: "select",
      fieldKey: "department",
      label: "학부·학과",
      required: true,
      initiallyDisabled: true,
      enabledWhen: [{ fieldKey: "college", operator: "hasValue" }]
    }
  },
  {
    spec: {
      type: "select",
      fieldKey: "currentGrade",
      label: "현재 학년",
      required: true
    }
  },
  {
    spec: {
      type: "button",
      label: "다음"
    }
  }
];

const action = {
  type: "navigate",
  targetScreenId: "ONB-02",
  executeWhen: {
    type: "allRequiredFieldsHaveValue",
    scope: "screen"
  },
  onExecutionBlocked: {
    type: "showMissingRequiredFields",
    focus: "firstMissingField"
  }
};

test("현재 화면의 필수 입력·선택 필드를 화면 순서대로 판정 후보로 찾는다", () => {
  assert.deepEqual(
    getRequiredFieldCandidates(elements).map(({ fieldKey, label }) => ({
      fieldKey,
      label
    })),
    [
      { fieldKey: "name", label: "이름" },
      { fieldKey: "studentNumber", label: "학번" },
      { fieldKey: "school", label: "학교" },
      { fieldKey: "college", label: "단과대학" },
      { fieldKey: "department", label: "학부·학과" },
      { fieldKey: "currentGrade", label: "현재 학년" }
    ]
  );
});

test("활성 조건을 만족한 필수 필드만 실행 시점에 값 존재를 판정한다", () => {
  const beforeSchool = evaluateButtonExecution({
    action,
    elements,
    values: {
      name: " 김바다 ",
      studentNumber: "2022123456",
      school: "   ",
      currentGrade: "1"
    }
  });

  assert.equal(beforeSchool.allowed, false);
  assert.deepEqual(beforeSchool.applicableFieldKeys, [
    "name",
    "studentNumber",
    "school",
    "currentGrade"
  ]);
  assert.deepEqual(beforeSchool.missingFieldKeys, ["school"]);
  assert.deepEqual(beforeSchool.onExecutionBlocked, action.onExecutionBlocked);

  const afterSchool = evaluateButtonExecution({
    action,
    elements,
    values: {
      name: "김바다",
      studentNumber: "2022123456",
      school: "school-1",
      college: null,
      currentGrade: "1"
    }
  });

  assert.deepEqual(afterSchool.applicableFieldKeys, [
    "name",
    "studentNumber",
    "school",
    "college",
    "currentGrade"
  ]);
  assert.deepEqual(afterSchool.missingFieldKeys, ["college"]);
});

test("공백 문자열과 null은 누락이며 숫자 0과 boolean false는 값이다", () => {
  const result = evaluateButtonExecution({
    action,
    elements: [
      { spec: { type: "input", fieldKey: "text", required: true } },
      { spec: { type: "input", fieldKey: "nullable", required: true } },
      { spec: { type: "input", fieldKey: "count", required: true } },
      { spec: { type: "input", fieldKey: "agreed", required: true } }
    ],
    values: {
      text: "  ",
      nullable: null,
      count: 0,
      agreed: false
    }
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.missingFieldKeys, ["text", "nullable"]);
});

test("모든 적용 대상 필드에 값이 있으면 이동 실행을 허용한다", () => {
  const result = evaluateButtonExecution({
    action,
    elements,
    values: {
      name: "김바다",
      studentNumber: "2022123456",
      school: "school-1",
      college: "college-1",
      department: "department-1",
      currentGrade: "1"
    }
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.missingFieldKeys, []);
  assert.equal(result.onExecutionBlocked, null);
});

test("executeWhen을 생략한 버튼은 필수값과 무관하게 항상 실행한다", () => {
  const result = evaluateButtonExecution({
    action: { type: "navigate", targetScreenId: "ONB-01" },
    elements,
    values: {}
  });

  assert.deepEqual(result, {
    allowed: true,
    applicableFieldKeys: [],
    missingFieldKeys: [],
    onExecutionBlocked: null
  });
});

test("executeWhen과 onExecutionBlocked는 함께만 명시할 수 있다", () => {
  assert.throws(
    () =>
      evaluateButtonExecution({
        action: {
          type: "navigate",
          targetScreenId: "ONB-01",
          executeWhen: { type: "allRequiredFieldsHaveValue", scope: "screen" }
        },
        elements,
        values: {}
      }),
    /함께/
  );
  assert.throws(
    () =>
      evaluateButtonExecution({
        action: {
          type: "navigate",
          targetScreenId: "ONB-01",
          onExecutionBlocked: {
            type: "showMissingRequiredFields",
            focus: "firstMissingField"
          }
        },
        elements,
        values: {}
      }),
    /함께/
  );
});

test("ONB-02의 버튼은 필수 입력이 없는 화면이므로 실행 조건을 갖지 않는다", async () => {
  const { readFile } = await import("node:fs/promises");
  const screenSpec = JSON.parse(
    await readFile(
      new URL(
        "../specs/figma/vada-wireframe/screens/ONB-02/screen.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  const buttons = screenSpec.elements.filter(
    ({ spec }) => spec.type === "button"
  );

  assert.equal(buttons.length, 3);
  for (const { spec } of buttons) {
    assert.equal("executeWhen" in spec.action, false);
    assert.equal("onExecutionBlocked" in spec.action, false);
  }
});

// 되풀이되는 묶음 안의 칸도 채워야 하는 칸이다.
//
// 한동안 최상위만 봐서 FIN-REQ-01은 필수 10개 중 3개만 보였고 FIN-REV-01은
// 0개라 늘 통과했다. 실제 번들로 재현해 확인한 뒤 고쳤다.
test("중첩된 필수 칸도 후보에 든다", () => {
  const elements = [
    {
      source: { nodeId: "1:1", name: "Container", figmaType: "FRAME" },
      spec: {
        type: "list",
        fieldKey: "items",
        itemFields: [
          {
            source: { nodeId: "1:2", name: "Text Input", figmaType: "FRAME" },
            spec: { type: "input", fieldKey: "itemName", label: "품목명", required: true }
          }
        ]
      }
    }
  ];

  const candidates = getRequiredFieldCandidates(elements);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].fieldKey, "itemName");
  assert.equal(candidates[0].inList, "items");
});

test("칸 목록이 데이터에서 오는 묶음도 후보에 든다", () => {
  const candidates = getRequiredFieldCandidates([
    { spec: { type: "fieldSet", fieldKey: "corrections", label: "수정 내용", required: true } }
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].fromSet, true);
});

// 판정기가 스스로 답할 수 없는 것을 짐작하면 조용히 통과시키게 된다.
test("되풀이되는 칸은 화면이 답하지 않으면 던진다", () => {
  const elements = [
    {
      spec: {
        type: "list",
        fieldKey: "items",
        itemFields: [{ spec: { type: "input", fieldKey: "itemName", required: true } }]
      }
    }
  ];
  const action = {
    type: "submit",
    mutationKey: "x",
    onSuccess: {},
    executeWhen: { type: "allRequiredFieldsHaveValue", scope: "screen" },
    onExecutionBlocked: { type: "showMissingRequiredFields", focus: "firstMissingField" }
  };

  assert.throws(
    () => evaluateButtonExecution({ action, elements, values: {} }),
    /isFilled/
  );
  assert.equal(
    evaluateButtonExecution({ action, elements, values: {}, isFilled: () => true }).allowed,
    true
  );
  assert.equal(
    evaluateButtonExecution({ action, elements, values: {}, isFilled: () => false }).allowed,
    false
  );
});

// 무엇이 '다 됐다'인지를 조직의 규칙이 정하는 자리.
test("서버가 막았는지는 서버가 말한다", () => {
  const action = {
    type: "submit",
    mutationKey: "x",
    onSuccess: {},
    executeWhen: {
      type: "sourceAllows",
      dataSourceKey: "finance.paymentEvidenceSummary",
      blockedNoteField: "completeBlockedNote"
    },
    onExecutionBlocked: { type: "showBlockedNote" }
  };

  assert.throws(() => evaluateButtonExecution({ action, elements: [] }), /sourceBlockedNote/);

  const open = evaluateButtonExecution({ action, elements: [], sourceBlockedNote: "" });
  assert.equal(open.allowed, true);

  const shut = evaluateButtonExecution({
    action,
    elements: [],
    sourceBlockedNote: "증빙 서류 2건이 아직 등록되지 않았습니다."
  });
  assert.equal(shut.allowed, false);
  assert.equal(shut.blockedNote, "증빙 서류 2건이 아직 등록되지 않았습니다.");
});
