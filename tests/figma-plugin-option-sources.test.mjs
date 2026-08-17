import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  filterOptionSourceOptions,
  findOptionSourceByKey,
  getOptionSourceReadiness,
  normalizeOptionSourceCatalog
} from "../apps/figma-plugin/src/option-sources.mjs";

function createMessages(subject) {
  return {
    idle: `${subject}을(를) 불러올 준비가 되었습니다`,
    loading: `${subject}을(를) 불러오는 중입니다`,
    empty: `${subject}이(가) 없습니다`,
    error: `${subject}을(를) 불러오지 못했습니다`
  };
}

function createCatalog() {
  return {
    schemaVersion: 2,
    sources: [
      {
        key: "education.schools",
        type: "remote",
        description: "학교명 검색",
        params: [],
        request: {
          method: "GET",
          path: "/api/education/schools",
          loadOn: "search",
          search: {
            mode: "remote",
            queryParam: "q",
            minLength: 2,
            debounceMs: 300
          }
        },
        messages: createMessages("학교")
      },
      {
        key: "education.colleges",
        type: "remote",
        description: "선택한 학교의 단과대학",
        params: ["schoolId"],
        request: {
          method: "GET",
          path: "/api/education/colleges",
          loadOn: "open",
          search: {
            mode: "client"
          }
        },
        messages: createMessages("단과대학")
      },
      {
        key: "education.currentGrades",
        type: "static",
        description: "현재 학년",
        params: [],
        options: [
          { value: "1", label: "1학년" },
          { value: "2", label: "2학년" }
        ]
      }
    ]
  };
}

test("옵션 출처 카탈로그를 검토 UI가 사용할 안전한 값으로 정규화한다", () => {
  const catalog = createCatalog();
  const normalized = normalizeOptionSourceCatalog(catalog);

  assert.deepEqual(normalized, catalog);
  assert.notEqual(normalized, catalog);
  assert.notEqual(normalized.sources, catalog.sources);
  assert.deepEqual(
    findOptionSourceByKey(normalized, "education.colleges"),
    catalog.sources[1]
  );
  assert.equal(findOptionSourceByKey(normalized, "unknown"), null);
});

test("중복 key나 잘못된 인자 선언은 카탈로그 오류로 거부한다", () => {
  const duplicate = createCatalog();
  duplicate.sources.push({ ...duplicate.sources[0] });

  assert.throws(
    () => normalizeOptionSourceCatalog(duplicate),
    /key가 중복되었습니다/
  );
  assert.throws(
    () =>
      normalizeOptionSourceCatalog({
        schemaVersion: 2,
        sources: [
          {
            key: "education.colleges",
            type: "remote",
            description: "단과대학",
            params: ["schoolId", "schoolId"],
            request: {
              method: "GET",
              path: "/api/education/colleges",
              loadOn: "open",
              search: { mode: "client" }
            },
            messages: createMessages("단과대학")
          }
        ]
      }),
    /params가 중복되었습니다/
  );
});

test("static과 remote 출처에 필요한 계약이 없으면 거부한다", () => {
  const remoteWithoutRequest = createCatalog();
  delete remoteWithoutRequest.sources[0].request;

  const staticWithoutOptions = createCatalog();
  delete staticWithoutOptions.sources[2].options;

  assert.throws(
    () => normalizeOptionSourceCatalog(remoteWithoutRequest),
    /request가 필요합니다/
  );
  assert.throws(
    () => normalizeOptionSourceCatalog(staticWithoutOptions),
    /options가 필요합니다/
  );
});

test("출처 key와 무관하게 검색 방식과 인자 매핑으로 구현 준비 상태를 판단한다", () => {
  const customRemoteSource = {
    ...createCatalog().sources[1],
    key: "catalog.locations"
  };

  assert.deepEqual(
    getOptionSourceReadiness(customRemoteSource, {
      searchable: true,
      params: { schoolId: "school" }
    }),
    { ready: true, issues: [] }
  );
  assert.deepEqual(
    getOptionSourceReadiness(customRemoteSource, {
      searchable: false,
      params: {}
    }),
    {
      ready: false,
      issues: [
        "schoolId 인자에 화면 fieldKey를 연결해야 합니다.",
        "검색 계약을 사용하려면 searchable이 true여야 합니다."
      ]
    }
  );
});

test("메뉴를 열어 불러오는 원격 출처는 검색 계약 없이도 사용할 수 있다", () => {
  const catalog = createCatalog();
  const source = catalog.sources[1];
  delete source.request.search;

  const normalized = normalizeOptionSourceCatalog(catalog);
  assert.deepEqual(
    getOptionSourceReadiness(normalized.sources[1], {
      searchable: false,
      params: { schoolId: "school" }
    }),
    { ready: true, issues: [] }
  );
});

test("ONB-01 선택 요소는 wireframe 카탈로그 key와 인자 매핑만 참조한다", async () => {
  const [catalogText, screenText] = await Promise.all([
    readFile(
      new URL(
        "../specs/figma/vada-wireframe/option-sources.json",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../specs/figma/vada-wireframe/screens/ONB-01/screen.json",
        import.meta.url
      ),
      "utf8"
    )
  ]);
  const catalog = normalizeOptionSourceCatalog(JSON.parse(catalogText));
  const screen = JSON.parse(screenText);
  const selectByFieldKey = new Map(
    screen.elements
      .filter((element) => element.spec.type === "select")
      .map((element) => [element.spec.fieldKey, element.spec])
  );
  const expected = {
    school: {
      key: "education.schools"
    },
    college: {
      key: "education.colleges",
      params: {
        schoolId: "school"
      }
    },
    department: {
      key: "education.departments",
      params: {
        schoolId: "school",
        collegeId: "college"
      }
    },
    currentGrade: {
      key: "education.currentGrades"
    }
  };

  for (const [fieldKey, optionsSource] of Object.entries(expected)) {
    const spec = selectByFieldKey.get(fieldKey);
    assert.ok(spec, `${fieldKey} 선택 요소가 필요합니다.`);
    assert.deepEqual(spec.optionsSource, optionsSource);
    assert.ok(
      findOptionSourceByKey(catalog, optionsSource.key),
      `${optionsSource.key} 카탈로그 항목이 필요합니다.`
    );
    assert.equal("type" in spec.optionsSource, false);
  }
});

test("현재 학년 카탈로그는 1학년부터 6학년까지 문자열 값을 제공한다", async () => {
  const catalog = normalizeOptionSourceCatalog(
    JSON.parse(
      await readFile(
        new URL(
          "../specs/figma/vada-wireframe/option-sources.json",
          import.meta.url
        ),
        "utf8"
      )
    )
  );
  const currentGrades = findOptionSourceByKey(
    catalog,
    "education.currentGrades"
  );

  assert.deepEqual(currentGrades?.options, [
    { value: "1", label: "1학년" },
    { value: "2", label: "2학년" },
    { value: "3", label: "3학년" },
    { value: "4", label: "4학년" },
    { value: "5", label: "5학년" },
    { value: "6", label: "6학년" }
  ]);
});

test("정적 선택지 검토 검색은 value와 label을 모두 찾고 원본 속성을 보존한다", () => {
  const options = [
    { value: "1", label: "1학년" },
    { value: "graduate", label: "졸업생", disabled: true }
  ];

  assert.deepEqual(filterOptionSourceOptions(options, "1"), [options[0]]);
  assert.deepEqual(filterOptionSourceOptions(options, "졸업"), [options[1]]);
  assert.deepEqual(filterOptionSourceOptions(options, "GRAD"), [options[1]]);
  assert.deepEqual(filterOptionSourceOptions(options, "  "), options);
});

test("ONB-01 원격 출처는 호출 시점과 검색 방식을 중앙 계약으로 선언한다", async () => {
  const catalog = normalizeOptionSourceCatalog(
    JSON.parse(
      await readFile(
        new URL(
          "../specs/figma/vada-wireframe/option-sources.json",
          import.meta.url
        ),
        "utf8"
      )
    )
  );

  assert.deepEqual(
    findOptionSourceByKey(catalog, "education.schools")?.request,
    {
      method: "GET",
      path: "/api/education/schools",
      loadOn: "search",
      search: {
        mode: "remote",
        queryParam: "q",
        minLength: 2,
        debounceMs: 300
      }
    }
  );
  assert.deepEqual(
    findOptionSourceByKey(catalog, "education.colleges")?.request,
    {
      method: "GET",
      path: "/api/education/colleges",
      loadOn: "open",
      search: { mode: "client" }
    }
  );
  assert.deepEqual(
    findOptionSourceByKey(catalog, "education.departments")?.request,
    {
      method: "GET",
      path: "/api/education/departments",
      loadOn: "open",
      search: { mode: "client" }
    }
  );
});
