import { collectFieldKeysByScope } from "./form-validation.mjs";
import { payloadFieldKeysByScope } from "./mutation-validation.mjs";
import { isObject } from "./spec-validation-values.mjs";

const paramsOf = (screen, onlyRequired) =>
  new Set(
    (Array.isArray(screen.spec.params) ? screen.spec.params : [])
      .filter((param) => !onlyRequired || param?.optional !== true)
      .map((param) => param?.key)
      .filter((key) => typeof key === "string")
  );

/** 교차 참조 검사에서 여러 번 찾는 카탈로그 항목을 한 번만 색인한다. */
export function createValidationIndexes({
  screens,
  optionSources,
  dataSources,
  stateScopes,
  mutations
}) {
  const namedScreens = screens.filter(
    (screen) => typeof screen?.spec?.screenId === "string"
  );
  const optionList =
    isObject(optionSources) && Array.isArray(optionSources.sources)
      ? optionSources.sources
      : [];
  const dataSourceList =
    isObject(dataSources) && Array.isArray(dataSources.sources)
      ? dataSources.sources
      : [];
  const scopeList =
    isObject(stateScopes) && Array.isArray(stateScopes.scopes)
      ? stateScopes.scopes
      : [];
  const mutationList =
    isObject(mutations) && Array.isArray(mutations.mutations)
      ? mutations.mutations
      : [];

  return {
    screenIds: new Set(namedScreens.map((screen) => screen.spec.screenId)),
    screenParamsById: new Map(
      namedScreens.map((screen) => [screen.spec.screenId, paramsOf(screen, false)])
    ),
    requiredParamsById: new Map(
      namedScreens.map((screen) => [screen.spec.screenId, paramsOf(screen, true)])
    ),
    sourceByKey: new Map(optionList.map((source) => [source.key, source])),
    dataSourceByKey: new Map(dataSourceList.map((source) => [source.key, source])),
    scopeKeys: new Set(scopeList.map((scope) => scope.key)),
    fieldKeysByScope: collectFieldKeysByScope(screens),
    clearOnByScope: new Map(
      scopeList.map((scope) => [scope.key, Array.isArray(scope.clearOn) ? scope.clearOn : []])
    ),
    mutationList,
    mutationKeys: new Set(mutationList.map((mutation) => mutation.key)),
    mutationByKey: new Map(mutationList.map((mutation) => [mutation.key, mutation])),
    payloadFieldKeys: payloadFieldKeysByScope(screens)
  };
}
