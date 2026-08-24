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
