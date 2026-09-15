import assert from "node:assert/strict";
import { test } from "node:test";

import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";

// 권한 규칙이 스스로 어긋나면 판정할 수가 없다. 스키마는 모양만 보므로 여기서 이름을 본다.
function permissionsFixture(overrides = {}) {
  return {
    schemaVersion: 1,
    description: "권한",
    conditions: [
      { key: "always", description: "언제나" },
      { key: "eventStaff", description: "그 행사의 운영 조직", needs: "event" }
    ],
    areas: [
      {
        key: "event.manage",
        name: "행사 정보 수정",
        drawnInMatrix: true,
        rules: {
          chair: { when: "always", label: "가능" },
          head: { when: "eventStaff", label: "행사 조직만" },
          member: { when: "eventStaff", label: "행사 조직만" }
        }
      }
    ],
    ...overrides
  };
}

test("없는 조건을 가리키는 권한 규칙은 오류다", () => {
  const permissions = permissionsFixture();
  permissions.areas[0].rules.chair.when = "없는조건";

  const findings = collectSpecFindings({ screens: [], permissions });
  assert.equal(
    findings.filter((f) => f.message.includes("없는 조건 '없는조건'")).length,
    1
  );
});

test("표에 그리는 줄인데 칸에 그려질 말이 없으면 오류다", () => {
  const permissions = permissionsFixture();
  delete permissions.areas[0].rules.head.label;

  const findings = collectSpecFindings({ screens: [], permissions });
  assert.equal(
    findings.filter((f) => f.message.includes("head 칸에 그려질 말이 없습니다")).length,
    1
  );
});

// **판정할 수 없는 자리는 짐작으로 열리거나 짐작으로 막힌다.**
// '행사 조직만'은 어느 행사인지 모르면 답할 수 없다.
test("조건이 대상을 요구하는데 그 인자가 없으면 경고다", () => {
  const dataSources = {
    sources: [
      {
        key: "event.basics",
        shape: "object",
        description: "행사 기본정보",
        authorize: { area: "event.manage" },
        params: [],
        fields: [{ key: "title", description: "이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({
    screens: [],
    dataSources,
    permissions: permissionsFixture()
  });
  const warned = findings.filter((f) => f.message.includes("조건을 판정할 수 없습니다"));
  assert.equal(warned.length, 1);
  assert.equal(warned[0].level, "warning");
});

test("권한 대상으로 가리킨 인자가 선언돼 있지 않으면 오류다", () => {
  const dataSources = {
    sources: [
      {
        key: "event.basics",
        shape: "object",
        description: "행사 기본정보",
        authorize: { area: "event.manage", object: "eventId" },
        params: [],
        fields: [{ key: "title", description: "이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({
    screens: [],
    dataSources,
    permissions: permissionsFixture()
  });
  assert.equal(
    findings.filter((f) => f.message.includes("권한 대상으로 가리킨 인자 'eventId'")).length,
    1
  );
});

test("없는 권한 영역을 가리키면 오류다", () => {
  const dataSources = {
    sources: [
      {
        key: "event.basics",
        shape: "object",
        description: "행사 기본정보",
        authorize: { area: "없는영역" },
        params: [],
        fields: [{ key: "title", description: "이름" }]
      }
    ]
  };

  const findings = collectSpecFindings({
    screens: [],
    dataSources,
    permissions: permissionsFixture()
  });
  assert.equal(
    findings.filter((f) => f.message.includes("없는 권한 영역 '없는영역'")).length,
    1
  );
});
// **화면을 보는 사람이 그 화면의 출처에 닿는가.**
//
// 화면의 `viewer`와 출처의 `authorize.area`는 서로 다른 파일에 따로 적힌다. 어긋나도
// 명세는 정합하고 화면도 그려지므로 **배포한 뒤 진짜 사람이 열어야 403이 온다.**
// 실제로 그랬다: 학생회에 들어오려는 사람이 보는 화면 다섯이 학교 목록을 읽는데
// 그 목록이 `member`를 요구했다 — 학교를 골라야 구성원이 되는데 구성원이라야 학교를
// 고를 수 있었다.
/**
 * 닿는 관계는 **명세가 든다**(`permissions.json`의 `viewerReach`). 검사도 그것을 준다 —
 * 여기서 따로 적으면 명세를 고쳐도 이 검사가 옛 규칙을 재게 된다.
 */
const REACH = {
  // 닿는 관계만으로는 모자란다 — 가리키는 영역이 실재해야 다른 검사가 걸리지 않는다.
  conditions: [],
  areas: [
    { key: "public", name: "로그인 없이 열린다", rules: {} },
    { key: "signedIn", name: "로그인만 하면 된다", rules: {} },
    { key: "member", name: "그 학생회의 구성원이면 된다", rules: {} },
  ],
  viewerReach: {
    description: "보는 사람이 어느 권한 영역에 닿는가.",
    viewers: [
      { key: "external", name: "로그인 없이 보는 사람", reaches: ["public"], note: "세션이 없다." },
      {
        key: "joining",
        name: "로그인만 한 사람",
        reaches: ["public", "signedIn"],
        note: "소속이 없다.",
      },
      { key: "member", name: "구성원", reaches: [], note: "전부에 닿는다." },
    ],
  },
}

function joiningScreen(area) {
  return {
    screens: [
      {
        file: "w/screens/ONB-01/screen.json",
        spec: {
          screenId: "ONB-01",
          viewer: "joining",
          elements: [{ type: "Dropdown", optionsSource: { key: "education.schools" } }]
        }
      }
    ],
    optionSources: { sources: [{ key: "education.schools", authorize: { area } }] },
    permissions: REACH
  };
}

const reachFindings = (area) =>
  collectSpecFindings(joiningScreen(area)).filter((finding) =>
    finding.message.includes("education.schools")
  );

test("들어오려는 사람이 보는 화면이 구성원 전용 출처를 읽으면 오류다", () => {
  const findings = reachFindings("member");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "w/screens/ONB-01/screen.json");
  assert.match(findings[0].message, /'joining'가 보는 화면인데/);
});

test("로그인만 하면 되는 출처는 들어오려는 사람이 읽어도 된다", () => {
  assert.deepEqual(reachFindings("signedIn"), []);
});

// 로그인이 아예 없는 화면은 `signedIn`에도 닿지 못한다. 한 칸 더 밖이다.
test("로그인 없는 화면은 로그인이 필요한 출처를 읽을 수 없다", () => {
  const spec = joiningScreen("signedIn");
  spec.screens[0].spec.viewer = "external";
  const findings = collectSpecFindings(spec).filter((finding) =>
    finding.message.includes("education.schools")
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /\[public\]에만 닿습니다/);
});

// 구성원이 보는 화면(viewer를 적지 않은 화면)은 여기서 재지 않는다.
test("구성원이 보는 화면은 무엇에든 닿는다", () => {
  const spec = joiningScreen("member");
  delete spec.screens[0].spec.viewer;
  assert.deepEqual(
    collectSpecFindings(spec).filter((finding) =>
      finding.message.includes("education.schools")
    ),
    []
  );
});

// **쓰는 쪽도 같은 벽이다.** 읽기만 재면 들어오려는 사람이 못 부를 변이를 매단 화면이
// 그대로 지나간다.
test("들어오려는 사람이 보는 화면이 구성원 전용 변이를 매달면 오류다", () => {
  const findings = collectSpecFindings({
    screens: [
      {
        file: "w/screens/ORG-02/screen.json",
        spec: {
          screenId: "ORG-02",
          viewer: "joining",
          elements: [{ type: "Button", submitAction: { mutationKey: "org.create" } }]
        }
      }
    ],
    mutations: { mutations: [{ key: "org.create", authorize: { area: "member" } }] },
    permissions: REACH
  }).filter((finding) => finding.message.includes("org.create"));
  assert.equal(findings.length, 1);
});
