import {
  checkFieldReferences,
  checkGroupMembers,
  checkNoteFieldRefs,
  checkPropertyOrder,
  checkSummaryCompute,
  collectFieldKeysByScope
} from "./form-validation.mjs";
import {
  checkOnSuccessNote,
  checkRepeat,
  checkResultFields,
  checkSubmitAction,
  payloadFieldKeysByScope
} from "./mutation-validation.mjs";
import {
  checkArgumentMap,
  checkArgumentValues,
  checkRequiredParams
} from "./source-parameters.mjs";
import {
  checkBreadcrumb,
  checkDataSource,
  checkDraftFrom,
  checkDrawnWhen,
  checkFieldSet,
  checkQueryParams,
  checkSteps,
  collectScreenTitleSourceFindings
} from "./source-validation.mjs";
import {
  checkCandidatesSource,
  checkItemMovePool,
  checkListColumns,
  checkListItemFields,
  checkListPaging,
  checkListReferences,
  checkNestedListTitleField,
  checkRowToneField
} from "./list-validation.mjs";
import { checkOptionCounts, checkOptionsSource } from "./option-validation.mjs";
import {
  collectDesignTitleFindings,
  collectScreenDesignFindings
} from "./design-validation.mjs";
export { collectDesignNodeIds } from "./design-validation.mjs";
import { collectPermissionFindings } from "./permission-validation.mjs";
import { elementLabel, FIELD_ELEMENT_TYPES, isObject } from "./spec-validation-values.mjs";
import {
  checkBranchingTargets,
  checkCopyAction,
  checkDownloadAction,
  checkNavigateParams,
  checkOnSuccessParams,
  checkParamMissingNotes,
  collectElementTargetFindings,
  collectFlowFindings
} from "./action-navigation-validation.mjs";
import {
  collectScreenShellFindings,
  collectScreenWorkspaceFindings,
  collectShellFindings
} from "./shell-validation.mjs";
import { allElementsOf } from "./element-walk.mjs";

import { DRAFT_SIGNALS } from "./screen-draft.mjs";

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
  const screenIds = new Set(
    screens
      .map((screen) => screen?.spec?.screenId)
      .filter((screenId) => typeof screenId === "string")
  );
  // 화면마다 '받는 인자'. 이동하는 쪽이 무엇을 넘겨야 하는지 여기서만 알 수 있다.
  //
  // 두 벌이다. **받을 수 있는 것**과 **반드시 받아야 하는 것**은 다르다 —
  // 없어도 화면이 열리는 인자는 넘기지 않아도 되지만, 넘기면 받아야 한다.
  // FIN-REQ-01은 요청 id가 있으면 고치고 없으면 새로 쓴다.
  const paramsOf = (screen, onlyRequired) =>
    new Set(
      (Array.isArray(screen.spec.params) ? screen.spec.params : [])
        .filter((param) => !onlyRequired || param?.optional !== true)
        .map((param) => param?.key)
        .filter((key) => typeof key === "string")
    );
  const named = screens.filter((screen) => typeof screen?.spec?.screenId === "string");
  const screenParamsById = new Map(
    named.map((screen) => [screen.spec.screenId, paramsOf(screen, false)])
  );
  const requiredParamsById = new Map(
    named.map((screen) => [screen.spec.screenId, paramsOf(screen, true)])
  );
  const sourceByKey = new Map(
    (isObject(optionSources) && Array.isArray(optionSources.sources)
      ? optionSources.sources
      : []
    ).map((source) => [source.key, source])
  );
  const dataSourceByKey = new Map(
    (isObject(dataSources) && Array.isArray(dataSources.sources)
      ? dataSources.sources
      : []
    ).map((source) => [source.key, source])
  );
  const scopeKeys = new Set(
    (isObject(stateScopes) && Array.isArray(stateScopes.scopes)
      ? stateScopes.scopes
      : []
    ).map((scope) => scope.key)
  );
  const fieldKeysByScope = collectFieldKeysByScope(screens);
  const scopeList =
    isObject(stateScopes) && Array.isArray(stateScopes.scopes) ? stateScopes.scopes : [];
  const clearOnByScope = new Map(
    scopeList.map((scope) => [scope.key, Array.isArray(scope.clearOn) ? scope.clearOn : []])
  );
  const mutationList =
    isObject(mutations) && Array.isArray(mutations.mutations) ? mutations.mutations : [];
  const mutationKeys = new Set(mutationList.map((mutation) => mutation.key));
  const mutationByKey = new Map(mutationList.map((mutation) => [mutation.key, mutation]));

  const payloadFieldKeys = payloadFieldKeysByScope(screens);

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

    const flattened = allElementsOf(spec);
    const fieldKeys = new Set();
    const seenFieldKeys = new Set();
    const seenNodeIds = new Set();
    flattened.forEach(({ element }, index) => {
      const nodeId = element?.source?.nodeId;
      if (typeof nodeId === "string") {
        if (seenNodeIds.has(nodeId)) {
          findings.push({
            level: "error",
            file,
            message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 다른 요소와 중복됩니다.`
          });
        }
        seenNodeIds.add(nodeId);
      }

      const spec_ = element?.spec;
      if (isObject(spec_) && FIELD_ELEMENT_TYPES.has(spec_.type)) {
        const fieldKey = spec_.fieldKey;
        if (typeof fieldKey === "string") {
          if (seenFieldKeys.has(fieldKey)) {
            findings.push({
              level: "error",
              file,
              message: `${elementLabel(element, index)}의 fieldKey '${fieldKey}'가 다른 요소와 중복됩니다.`
            });
          }
          seenFieldKeys.add(fieldKey);
          fieldKeys.add(fieldKey);
        }
      }

      // **고른 것도 화면의 값이다.** 누르면 그 항목이 칸에 담기므로(`choose`)
      // 그 칸은 입력 칸과 똑같이 다른 요소가 가리킬 수 있어야 한다. 여기 없으면
      // 가리키는 자리마다 '화면에 없는 칸'이라고 잘못 말한다.
      for (const at of ['action', 'itemAction', 'emptyAction']) {
        const action = isObject(spec_) ? spec_[at] : undefined;
        if (isObject(action) && action.type === 'choose' && typeof action.fieldKey === 'string') {
          fieldKeys.add(action.fieldKey);
        }
      }
    });

    const listsByFieldKey = new Map(
      flattened
        .map(({ element }) => element?.spec)
        .filter((candidate) => isObject(candidate) && candidate.type === "list")
        .map((candidate) => [candidate.fieldKey, candidate])
    );
    const groupedFieldKeys = new Set();
    flattened.forEach(({ element, inList }, index) => {
      const spec_ = element?.spec;
      if (!isObject(spec_)) {
        return;
      }
      const context = {
        file,
        element,
        index,
        inList,
        listsByFieldKey,
        optionSources,
        sourceByKey,
        dataSources,
        dataSourceByKey,
        fieldKeys,
        stateScopes,
        scopeKeys,
        fieldKeysByScope,
        groupedFieldKeys,
        mutations,
        mutationKeys,
        mutationByKey,
        clearOnByScope,
        // 갈림길이 가리킨 화면이 실제로 있는지 보려면 화면 목록이 필요하다.
        screenIds,
        // 보내고 나서 가는 화면이 무엇을 필수로 받는지 보려면 그 명세가 필요하다.
        screens,
        screenScopeKey: spec.stateScopeKey,
        // 이 화면이 밖에서 받는 인자. 상세 화면만 갖는다.
        screenParams: new Set(
          (Array.isArray(spec.params) ? spec.params : [])
            .map((param) => param?.key)
            .filter((key) => typeof key === "string")
        ),
        screenParamsById,
        requiredParamsById,
        propertyOrderByType
      };
      checkPropertyOrder(findings, context);
      // 유형과 무관하다 — 어느 요소든 데이터가 허락할 때만 그려질 수 있다.
      checkDrawnWhen(findings, context);
      if (spec_.type === "select") {
        checkOptionsSource(findings, context);
      }
      if (spec_.type === "note") {
        checkNoteFieldRefs(findings, context);
      }
      if (spec_.type === "group") {
        checkGroupMembers(findings, context);
      }
      if (spec_.type === "list") {
        checkListReferences(findings, context);
        checkListItemFields(findings, context);
        checkCandidatesSource(findings, context);
      }
      if (spec_.type === "button") {
        checkSubmitAction(findings, context);
        checkResultFields(findings, context);
        // 집어 가는 것과 받아 가는 것은 **button의 동작**이다. 오래 itemList
        // 가지에 걸려 있어서 checkCopyAction은 실제 명세에서 한 번도 돈 적이
        // 없었다 - itemList에는 action이 없다(itemAction이다). 계약 검사도
        // 없어 아무도 몰랐다.
        checkCopyAction(findings, context);
        checkDownloadAction(findings, context);
      }
      if (spec_.type === "summary") {
        checkSummaryCompute(findings, context);
      }
      if (spec_.type === "steps") {
        checkSteps(findings, context);
      }
      if (spec_.type === "fieldSet") {
        checkFieldSet(findings, context);
      }
      if (
        spec_.type === "summary" ||
        spec_.type === "itemList" ||
        spec_.type === "steps" ||
        spec_.type === "fieldSet"
      ) {
        checkDataSource(findings, context);
        // 조회 인자는 목록만의 것이 아니다 — 상세 화면의 요약도 한 건을 집어 온다.
        checkQueryParams(findings, context);
      }
      if (spec_.type === "itemList") {
        checkListColumns(findings, context);
        checkNestedListTitleField(findings, context);
        checkItemMovePool(findings, context);
        checkRowToneField(findings, context);
        checkListPaging(findings, context);
      }
      if (spec_.type === "select") {
        checkOptionCounts(findings, context);
      }
      checkOnSuccessParams(findings, context);
      checkOnSuccessNote(findings, context);
      checkBranchingTargets(findings, context);
      checkFieldReferences(findings, context);
      checkNavigateParams(findings, context);

      findings.push(...collectElementTargetFindings({ file, element, index, screenIds }));
    });

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
