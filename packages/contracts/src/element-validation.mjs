import {
  checkFieldReferences,
  checkGroupMembers,
  checkNoteFieldRefs,
  checkPropertyOrder,
  checkSummaryCompute
} from "./form-validation.mjs";
import {
  checkOnSuccessNote,
  checkResultFields,
  checkSubmitAction
} from "./mutation-validation.mjs";
import {
  checkDataSource,
  checkDrawnWhen,
  checkFieldSet,
  checkQueryParams,
  checkSteps
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
  checkBranchingTargets,
  checkCopyAction,
  checkDownloadAction,
  checkNavigateParams,
  checkOnSuccessParams,
  collectElementTargetFindings
} from "./action-navigation-validation.mjs";
import { allElementsOf } from "./element-walk.mjs";
import {
  elementLabel,
  FIELD_ELEMENT_TYPES,
  isObject
} from "./spec-validation-values.mjs";

/** 화면 요소의 색인과 교차 참조 검사를 기존 진단 순서대로 실행한다. */
export function collectScreenElementFindings({
  file,
  spec,
  screens,
  optionSources,
  dataSources,
  stateScopes,
  mutations,
  propertyOrderByType,
  indexes
}) {
  const findings = [];
  const {
    screenIds,
    screenParamsById,
    requiredParamsById,
    sourceByKey,
    dataSourceByKey,
    scopeKeys,
    fieldKeysByScope,
    clearOnByScope,
    mutationKeys,
    mutationByKey
  } = indexes;
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

    const elementSpec = element?.spec;
    if (isObject(elementSpec) && FIELD_ELEMENT_TYPES.has(elementSpec.type)) {
      const fieldKey = elementSpec.fieldKey;
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

    // choose가 담는 값도 다른 요소가 참조할 수 있는 화면 필드다.
    for (const at of ["action", "itemAction", "emptyAction"]) {
      const action = isObject(elementSpec) ? elementSpec[at] : undefined;
      if (isObject(action) && action.type === "choose" && typeof action.fieldKey === "string") {
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
  const screenParams = new Set(
    (Array.isArray(spec.params) ? spec.params : [])
      .map((param) => param?.key)
      .filter((key) => typeof key === "string")
  );

  flattened.forEach(({ element, inList }, index) => {
    const elementSpec = element?.spec;
    if (!isObject(elementSpec)) {
      return;
    }

    const baseContext = { file, element, index };
    const dataContext = {
      ...baseContext,
      inList,
      dataSources,
      dataSourceByKey,
      fieldKeys,
      screenParams
    };
    const optionContext = { ...dataContext, optionSources, sourceByKey };
    const formContext = {
      ...baseContext,
      inList,
      listsByFieldKey,
      fieldKeys,
      stateScopes,
      scopeKeys,
      fieldKeysByScope,
      groupedFieldKeys,
      propertyOrderByType
    };
    const mutationContext = {
      ...baseContext,
      mutations,
      mutationKeys,
      scopeKeys,
      stateScopes,
      screenScopeKey: spec.stateScopeKey,
      clearOnByScope
    };
    const navigationContext = {
      ...baseContext,
      dataSourceByKey,
      fieldKeys,
      screenParams,
      screenParamsById,
      requiredParamsById,
      mutationByKey,
      screens,
      screenIds
    };

    checkPropertyOrder(findings, formContext);
    checkDrawnWhen(findings, dataContext);
    if (elementSpec.type === "select") {
      checkOptionsSource(findings, optionContext);
    }
    if (elementSpec.type === "note") {
      checkNoteFieldRefs(findings, formContext);
    }
    if (elementSpec.type === "group") {
      checkGroupMembers(findings, formContext);
    }
    if (elementSpec.type === "list") {
      checkListReferences(findings, dataContext);
      checkListItemFields(findings, dataContext);
      checkCandidatesSource(findings, dataContext);
    }
    if (elementSpec.type === "button") {
      checkSubmitAction(findings, mutationContext);
      checkResultFields(findings, mutationContext);
      checkCopyAction(findings, navigationContext);
      checkDownloadAction(findings, navigationContext);
    }
    if (elementSpec.type === "summary") {
      checkSummaryCompute(findings, formContext);
    }
    if (elementSpec.type === "steps") {
      checkSteps(findings, dataContext);
    }
    if (elementSpec.type === "fieldSet") {
      checkFieldSet(findings, dataContext);
    }
    if (["summary", "itemList", "steps", "fieldSet"].includes(elementSpec.type)) {
      checkDataSource(findings, dataContext);
      checkQueryParams(findings, dataContext);
    }
    if (elementSpec.type === "itemList") {
      checkListColumns(findings, dataContext);
      checkNestedListTitleField(findings, dataContext);
      checkItemMovePool(findings, dataContext);
      checkRowToneField(findings, dataContext);
      checkListPaging(findings, dataContext);
    }
    if (elementSpec.type === "select") {
      checkOptionCounts(findings, optionContext);
    }
    checkOnSuccessParams(findings, navigationContext);
    checkOnSuccessNote(findings, mutationContext);
    checkBranchingTargets(findings, navigationContext);
    checkFieldReferences(findings, formContext);
    checkNavigateParams(findings, navigationContext);
    findings.push(...collectElementTargetFindings({ file, element, index, screenIds }));
  });

  return findings;
}
