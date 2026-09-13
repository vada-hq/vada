import { checkRepeat } from "./mutation-validation.mjs";
import {
  checkBreadcrumb,
  checkDraftFrom,
  collectScreenTitleSourceFindings
} from "./source-validation.mjs";
import {
  collectDesignTitleFindings,
  collectScreenDesignFindings
} from "./design-validation.mjs";
export { collectDesignNodeIds } from "./design-validation.mjs";
import { collectPermissionFindings } from "./permission-validation.mjs";
import { isObject } from "./spec-validation-values.mjs";
import {
  checkParamMissingNotes,
  collectFlowFindings
} from "./action-navigation-validation.mjs";
import {
  collectScreenShellFindings,
  collectScreenWorkspaceFindings,
  collectShellFindings
} from "./shell-validation.mjs";
import { collectScreenElementFindings } from "./element-validation.mjs";
import { createValidationIndexes } from "./validation-indexes.mjs";

/**
 * **한 이름이 두 벌을 가리키면 어느 쪽도 참이 아니다.**
 *
 * 읽는 쪽과 검사하는 쪽이 서로 다른 것을 고른다 — 데이터 출처는 `.find`로 **첫 것**을,
 * 검증기는 `Map`으로 **마지막 것**을 고르고, 선택지와 변이는 또 마지막 것이다. 그러면
 * 명세가 말하는 모양과 화면이 그리는 값이 조용히 갈린다.
 *
 * **초안에서도 오류다.** 같은 열쇠가 둘인 것이 옳은 때는 없다 — 아직 안 정한 것은
 * 열쇠를 둘로 만드는 것이 아니라 하나를 안 만드는 것이다.
 */
function checkCatalogKeysUnique(findings, groups) {
  for (const [items, what, file] of groups) {
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const key = item?.key;
      if (typeof key !== "string") continue;
      if (seen.has(key)) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${key}'가 두 번 적혀 있습니다. 읽는 쪽은 첫 것을, 검사하는 쪽은 마지막 것을 고릅니다.`
        });
        continue;
      }
      seen.add(key);
    }
  }
}

export function collectSpecFindings({
  screens = [],
  optionSources = null,
  dataSources = null,
  stateScopes = null,
  designs = {},
  flows = null,
  flowsFile = "flows.json",
  mutations = null,
  mutationsFile = "mutations.json",
  shell = null,
  shellFile = "shell.json",
  permissions = null,
  permissionsFile = "permissions.json",
  propertyOrderByType = null
} = {}) {
  const findings = [];
  const authorizeGroups = [
    [dataSources?.sources, "데이터 출처", "data-sources.json"],
    [optionSources?.sources, "선택지 출처", "option-sources.json"],
    [mutations?.mutations, "변이", mutationsFile]
  ];
  findings.push(...collectPermissionFindings({
    permissions, permissionsFile, screens, groups: authorizeGroups
  }));
  checkCatalogKeysUnique(findings, [
    ...authorizeGroups,
    [stateScopes?.scopes, "상태 스코프", "state-scopes.json"],
    [permissions?.areas, "권한 영역", permissionsFile],
    [permissions?.conditions, "권한 조건", permissionsFile]
  ]);
  const indexes = createValidationIndexes({
    screens, optionSources, dataSources, stateScopes, mutations
  });
  const {
    screenIds,
    dataSourceByKey,
    scopeKeys,
    mutationList,
    payloadFieldKeys
  } = indexes;

  // 제출 계약이 참조하는 payload 스코프는 카탈로그에 있어야 한다.
  for (const mutation of mutationList) {
    if (typeof mutation?.payloadScope === "string" && !scopeKeys.has(mutation.payloadScope)) {
      findings.push({
        level: "error",
        file: mutationsFile,
        message: `제출 계약 '${mutation.key}'의 payloadScope '${mutation.payloadScope}'가 상태 스코프 카탈로그에 없습니다.`
      });
    }
    checkRepeat(findings, mutationsFile, mutation, payloadFieldKeys);
  }

  for (const screen of screens) {
    const { file, spec } = screen;
    if (!isObject(spec) || !Array.isArray(spec.elements)) {
      continue;
    }

    // 위치에서 기대 screenId를 얻는다: screens/<screenId>/screen.json 또는
    // (과거 형태) screens/<screenId>.json 모두 지원한다.
    const segments = String(file).split("/");
    const screensIndex = segments.lastIndexOf("screens");
    const locationId =
      screensIndex >= 0 && segments.length > screensIndex + 1
        ? segments[screensIndex + 1].replace(/\.json$/u, "")
        : undefined;
    if (
      typeof spec.screenId === "string" &&
      locationId &&
      locationId !== spec.screenId
    ) {
      findings.push({
        level: "error",
        file,
        message: `screenId '${spec.screenId}'가 위치 '${locationId}'과 다릅니다.`
      });
    }

    findings.push(...collectDesignTitleFindings({
      file, spec, designEntry: designs[spec.screenId]
    }));

    if (typeof spec.stateScopeKey === "string") {
      if (!isObject(stateScopes)) {
        findings.push({
          level: "warning",
          file,
          message: `state-scopes.json이 없어 상태 스코프 '${spec.stateScopeKey}'를 확인하지 못했습니다.`
        });
      } else if (!scopeKeys.has(spec.stateScopeKey)) {
        findings.push({
          level: "error",
          file,
          message: `상태 스코프 '${spec.stateScopeKey}'가 카탈로그에 없습니다.`
        });
      }
    }

    findings.push(...collectScreenWorkspaceFindings({ file, spec, shell }));

    findings.push(...collectScreenTitleSourceFindings({
      file, spec, dataSources, dataSourceByKey
    }));

    const declaredScreenParams = new Set(
      (Array.isArray(spec.params) ? spec.params : [])
        .map((param) => param?.key)
        .filter((key) => typeof key === "string")
    );

    findings.push(...collectScreenShellFindings({ file, spec, shell }));

    checkParamMissingNotes(findings, file, spec);
    checkBreadcrumb(findings, file, spec, {
      dataSources,
      dataSourceByKey,
      screenParams: declaredScreenParams
    });
    checkDraftFrom(findings, file, spec, {
      dataSources,
      dataSourceByKey,
      screenParams: declaredScreenParams
    });

    findings.push(...collectScreenElementFindings({
      file,
      spec,
      screens,
      optionSources,
      dataSources,
      stateScopes,
      mutations,
      propertyOrderByType,
      indexes
    }));

    findings.push(...collectScreenDesignFindings({
      screen, designEntry: designs[spec.screenId], shell
    }));
  }

  findings.push(...collectShellFindings({
    shell, shellFile, screenIds, dataSources, dataSourceByKey
  }));

  findings.push(...collectFlowFindings({ flows, flowsFile, screenIds }));

  return findings;
}
