import assert from "node:assert/strict";
import { test } from "node:test";
import { collectPermissionFindings } from "../packages/contracts/src/permission-validation.mjs";
import { collectSpecFindings } from "../packages/contracts/src/spec-validation.mjs";

function mixedInput() {
  return {
    permissionsFile: "custom/permissions.json",
    permissions: {
      conditions: [{ key: "eventStaff", needs: "event" }],
      areas: [
        { key: "event.manage", rules: { member: { when: "eventStaff" } } },
        { key: "public", rules: { member: { when: "missing" } } }
      ],
      viewerReach: { viewers: [{ key: "joining", reaches: ["public"] }] }
    },
    groups: [
      [[{ key: "event.basics", shape: "object", fields: [{ key: "title" }], authorize: { area: "event.manage" }, params: [] }], "데이터 출처", "data-sources.json"],
      [[{ key: "schools", authorize: { area: "public" }, params: [{ key: "code" }] }], "선택지 출처", "option-sources.json"],
      [[{ key: "event.update", authorize: { area: "event.manage" }, params: [] }], "변이", "custom/mutations.json"]
    ],
    screens: [{
      file: "screens/ONB-01/screen.json",
      spec: { screenId: "ONB-01", viewer: "joining", elements: [], meta: { titleFrom: { dataSourceKey: "event.basics", field: "title" } } }
    }]
  };
}

const MIXED_FINDINGS = [
  { level: "error", file: "custom/permissions.json", message: "권한 영역 'public'의 member 규칙이 없는 조건 'missing'을 가리킵니다." },
  { level: "warning", file: "data-sources.json", message: "데이터 출처 'event.basics'의 권한 영역 'event.manage'는 event을 보고 판정하는데, 그 대상을 가리키는 인자가 이 자리에 없습니다 — 조건을 판정할 수 없습니다." },
  { level: "warning", file: "custom/mutations.json", message: "변이 'event.update'의 권한 영역 'event.manage'는 event을 보고 판정하는데, 그 대상을 가리키는 인자가 이 자리에 없습니다 — 조건을 판정할 수 없습니다." },
  { level: "error", file: "option-sources.json", message: "선택지 출처 'schools'의 인자 'code'가 밖에서 열리는 자리에 있는데 열쇠인지(secret) 정하지 않았습니다. 참이면 서버가 기록에서 지웁니다." },
  { level: "error", file: "screens/ONB-01/screen.json", message: "'joining'가 보는 화면인데 'event.basics'가 'event.manage'를 요구합니다. 이 화면을 여는 사람은 [public]에만 닿습니다." }
];

test("권한 검사는 오류·경고의 내용, 파일, 순서를 보존하고 입력을 바꾸지 않는다", () => {
  const input = mixedInput();
  const before = structuredClone(input);
  const first = collectPermissionFindings(input);
  const second = collectPermissionFindings(input);
  assert.deepEqual(first, MIXED_FINDINGS);
  assert.deepEqual(second, MIXED_FINDINGS);
  assert.notEqual(first, second);
  assert.deepEqual(input, before);
});

test("전체 검증기는 권한 결과 다음에 기존 카탈로그 검사를 이어 붙인다", () => {
  const { permissions, permissionsFile, screens, groups } = mixedInput();
  const findings = collectSpecFindings({
    permissions, permissionsFile, screens,
    dataSources: { sources: groups[0][0] },
    optionSources: { sources: groups[1][0] },
    mutations: { mutations: groups[2][0] },
    mutationsFile: groups[2][2],
    stateScopes: { scopes: [{ key: "same" }, { key: "same" }] }
  });
  assert.deepEqual(findings, [...MIXED_FINDINGS, {
    level: "error", file: "state-scopes.json",
    message: "상태 스코프 'same'가 두 번 적혀 있습니다. 읽는 쪽은 첫 것을, 검사하는 쪽은 마지막 것을 고릅니다."
  }]);
});

test("권한 명세가 없어도 공개 인자의 비밀값 선언은 검사한다", () => {
  assert.deepEqual(collectPermissionFindings(), []);
  const findings = collectPermissionFindings({ groups: [[[
    { key: "invite.accept", authorize: { area: "signedIn" }, params: [{ key: "token" }] },
    { key: "invite.check", authorize: { area: "public" }, params: [{ key: "token", secret: true }, { key: "page", secret: false }] }
  ], "변이", "mutations.json"]] });
  assert.deepEqual(findings, [{
    level: "error", file: "mutations.json",
    message: "변이 'invite.accept'의 인자 'token'가 밖에서 열리는 자리에 있는데 열쇠인지(secret) 정하지 않았습니다. 참이면 서버가 기록에서 지웁니다."
  }]);
});

test("권한 조건·대상 인자·공개 인자와 화면 접근이 정합하면 통과한다", () => {
  const input = mixedInput();
  input.permissions.conditions.push({ key: "always" });
  input.permissions.areas[1].rules.member.when = "always";
  for (const index of [0, 2]) {
    input.groups[index][0][0].authorize.object = "eventId";
    input.groups[index][0][0].params = [{ key: "eventId" }];
  }
  input.groups[1][0][0].params[0].secret = true;
  input.screens[0].spec.viewer = "member";
  input.permissions.viewerReach.viewers.push({ key: "member", reaches: [] });
  assert.deepEqual(collectPermissionFindings(input), []);
});

test("중첩 출처·선택지·변이를 빠짐없이 확인하고 반복 참조는 한 번씩 이름순으로 보고한다", () => {
  const keys = ["dataSourceKey", "poolSourceKey", "downloadSourceKey", "copySourceKey", "mutationKey"];
  const children = keys.map((key, index) => ({ [key]: `source.${index}` }));
  children.push({ optionsSource: { key: "options" } }, { dataSourceKey: "source.0" }, { dataSourceKey: "unknown" });
  const input = {
    permissions: {
      conditions: [{ key: "always" }],
      areas: [{ key: "member", rules: { member: { when: "always" } } }],
      viewerReach: { viewers: [{ key: "external", reaches: ["public"] }] }
    },
    groups: [[[
      ...keys.map((_, index) => ({ key: `source.${index}`, authorize: { area: "member" } })),
      { key: "options", authorize: { area: "member" } }
    ], "데이터 출처", "data-sources.json"]],
    screens: [{ file: "screens/EXT/screen.json", spec: { viewer: "external", nested: [{ children }] } }]
  };
  const denied = collectPermissionFindings(input);
  assert.deepEqual(denied, ["options", ...keys.map((_, index) => `source.${index}`)].map(key => ({
    level: "error", file: "screens/EXT/screen.json",
    message: `'external'가 보는 화면인데 '${key}'가 'member'를 요구합니다. 이 화면을 여는 사람은 [public]에만 닿습니다.`
  })));
});
