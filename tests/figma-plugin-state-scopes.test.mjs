import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findStateScopeByKey,
  normalizeStateScopeCatalog
} from "../apps/figma-plugin/src/state-scopes.mjs";

const catalogUrl = new URL(
  "../specs/figma/vada-wireframe/state-scopes.json",
  import.meta.url
);
const schemaUrl = new URL(
  "../packages/contracts/schemas/state-scopes.schema.json",
  import.meta.url
);
const onb01Url = new URL(
  "../specs/figma/vada-wireframe/screens/ONB-01.json",
  import.meta.url
);
const onb02Url = new URL(
  "../specs/figma/vada-wireframe/screens/ONB-02.json",
  import.meta.url
);
const uiHtmlUrl = new URL(
  "../apps/figma-plugin/src/ui.html",
  import.meta.url
);
const uiSourceUrl = new URL(
  "../apps/figma-plugin/src/ui.mjs",
  import.meta.url
);

function createCatalog() {
  return {
    schemaVersion: 1,
    scopes: [
      {
        key: "onboardingDraft",
        description: "온보딩 입력 초안",
        lifetime: "flow",
        clearOn: ["complete", "cancel"]
      }
    ]
  };
}

test("flow 상태 스코프 카탈로그를 정규화하고 key로 조회한다", () => {
  const input = createCatalog();
  const catalog = normalizeStateScopeCatalog(input);

  assert.deepEqual(catalog, input);
  assert.notEqual(catalog, input);
  assert.deepEqual(findStateScopeByKey(catalog, "onboardingDraft"), {
    key: "onboardingDraft",
    description: "온보딩 입력 초안",
    lifetime: "flow",
    clearOn: ["complete", "cancel"]
  });
  assert.equal(findStateScopeByKey(catalog, "unknown"), null);
});

test("중복 key나 지원하지 않는 생명주기는 상태 스코프 계약에서 거부한다", () => {
  assert.throws(
    () =>
      normalizeStateScopeCatalog({
        schemaVersion: 1,
        scopes: [
          ...createCatalog().scopes,
          ...createCatalog().scopes
        ]
      }),
    /중복/
  );
  assert.throws(
    () =>
      normalizeStateScopeCatalog({
        schemaVersion: 1,
        scopes: [
          {
            key: "onboardingDraft",
            description: "온보딩 입력 초안",
            lifetime: "application",
            clearOn: ["complete"]
          }
        ]
      }),
    /lifetime/
  );
});

test("ONB-01과 ONB-02는 이동마다 중복 설정하지 않고 같은 상태 스코프를 참조한다", async () => {
  const [schema, catalog, onb01, onb02] = await Promise.all([
    readFile(schemaUrl, "utf8").then(JSON.parse),
    readFile(catalogUrl, "utf8").then(JSON.parse),
    readFile(onb01Url, "utf8").then(JSON.parse),
    readFile(onb02Url, "utf8").then(JSON.parse)
  ]);

  assert.equal(schema.properties.scopes.type, "array");
  assert.deepEqual(normalizeStateScopeCatalog(catalog), catalog);
  assert.equal(onb01.stateScopeKey, "onboardingDraft");
  assert.equal(onb02.stateScopeKey, "onboardingDraft");

  for (const screen of [onb01, onb02]) {
    for (const element of screen.elements) {
      assert.equal("preserveState" in (element.spec.action ?? {}), false);
      assert.equal("retainValues" in (element.spec.action ?? {}), false);
    }
  }
});

test("플러그인은 현재 화면의 상태 스코프와 유지·제거 시점을 읽기 전용으로 표시한다", async () => {
  const [uiHtml, uiSource] = await Promise.all([
    readFile(uiHtmlUrl, "utf8"),
    readFile(uiSourceUrl, "utf8")
  ]);

  assert.match(uiHtml, /id="state-scope-summary"/);
  assert.match(uiHtml, /id="state-scope-key"/);
  assert.match(uiHtml, /id="state-scope-retention"/);
  assert.match(uiHtml, /id="state-scope-clear-on"/);
  assert.match(uiSource, /await loadStateScopesFromLocal\(/);
  assert.match(uiSource, /findStateScopeByKey\(/);
  assert.match(uiSource, /같은 스코프 화면 간 이동 시 값 유지·복원/);
  assert.match(uiSource, /완료·취소 시 제거/);
});
