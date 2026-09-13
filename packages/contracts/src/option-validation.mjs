import { elementLabel, isObject, paramKeys } from "./spec-validation-values.mjs";
import { checkArgumentMap, checkArgumentValues, checkRequiredParams } from "./source-parameters.mjs";


export function checkOptionsSource(findings, context) {
  const { file, element, index, optionSources, sourceByKey, fieldKeys } = context;
  const optionsSource = element.spec.optionsSource;
  if (!isObject(optionsSource) || typeof optionsSource.key !== "string") {
    return;
  }

  if (!isObject(optionSources)) {
    findings.push({
      level: "warning",
      file,
      message: `option-sources.json이 없어 ${elementLabel(element, index)}의 출처 '${optionsSource.key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const catalogSource = sourceByKey.get(optionsSource.key);
  if (!catalogSource) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 선택지 출처 '${optionsSource.key}'가 카탈로그에 없습니다.`
    });
    return;
  }

  const declaredParams = [...paramKeys(catalogSource)];
  const mapping = isObject(optionsSource.params) ? optionsSource.params : {};

  for (const param of declaredParams) {
    if (!(param in mapping)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 출처 '${optionsSource.key}'에 필요한 인자 '${param}' 매핑이 없습니다.`
      });
    }
  }
  checkArgumentValues(findings, context, mapping, {
    declared: new Set(declaredParams),
    where: `선택지 출처 '${optionsSource.key}'`
  });
  checkRequiredParams(
    findings, file, catalogSource, mapping,
    `${elementLabel(element, index)}의 선택지 출처 '${optionsSource.key}' 조회`
  );
}


// 선택지는 명세가, 각 선택지의 건수는 데이터가 정한다. 둘을 잇는 것은 value와
// fields[].key의 일치뿐이라 검사하지 않으면 배지가 통째로 비어도 알 수 없다.
export function checkOptionCounts(findings, context) {
  const { file, element, index, optionSources, sourceByKey, dataSources, dataSourceByKey } =
    context;
  const spec = element.spec;
  const counts = spec.optionCounts;

  if (!isObject(counts)) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(counts.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }

  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
    });
    return;
  }

  // 개수도 걸러서 오는 것이라 넘기는 인자가 있다. 조회 인자와 같은 것이므로
  // 같은 판정을 쓴다.
  checkArgumentMap(findings, context, counts.params, counts.dataSourceKey);

  const optionSource = isObject(optionSources)
    ? sourceByKey.get(spec.optionsSource?.key)
    : null;
  if (!optionSource || !Array.isArray(optionSource.options)) {
    return;
  }

  const countFields = new Set((source.fields ?? []).map((field) => field.key));
  for (const option of optionSource.options) {
    const value = option?.value;
    if (value !== undefined && !countFields.has(String(value))) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 개수 출처 '${counts.dataSourceKey}'에 선택지 '${value}'의 조각이 없습니다.`
      });
    }
  }
}
