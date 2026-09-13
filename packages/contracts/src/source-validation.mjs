import { allElementsOf } from "./element-walk.mjs";
import { elementLabel, FIELD_ELEMENT_TYPES, isObject, paramKeys } from "./spec-validation-values.mjs";
import { checkArgumentMap, checkArgumentValues, checkRequiredParams } from "./source-parameters.mjs";


// 제목 위의 현재 위치 경로.
//
// 조각의 글은 디자인이 그려 두었고 등록 노드이므로 대조기가 지킨다. 여기서
// 보는 것은 데이터에서 오는 조각뿐이다 — 출처 없이 field를 가리키면 화면이
// 무엇을 그려야 할지 알 수 없다.
export function checkBreadcrumb(findings, file, spec, { dataSources, dataSourceByKey, screenParams }) {
  const breadcrumb = isObject(spec.breadcrumb) ? spec.breadcrumb : null;
  if (!breadcrumb) {
    return;
  }

  const items = Array.isArray(breadcrumb.items) ? breadcrumb.items : [];
  const fields = items
    .map((item) => (isObject(item) ? item.field : undefined))
    .filter((field) => typeof field === "string");

  const key = breadcrumb.dataSourceKey;
  if (typeof key !== "string") {
    if (fields.length > 0) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 dataSourceKey 없이 조각 '${fields[0]}'를 가리킵니다.`
      });
    }
    return;
  }
  if (fields.length === 0) {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로가 데이터 출처 '${key}'를 쓰지 않습니다. 조각을 가리키지 않을 거면 출처도 없습니다.`
    });
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 현재 위치 경로의 출처 '${key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(key);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `현재 위치 경로의 출처 '${key}'는 shape가 '${source.shape}'입니다. 지금 있는 자리는 한 건이므로 object여야 합니다.`
    });
  }

  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const field of fields) {
    if (!known.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
      });
    }
  }

  const declared = paramKeys(source);
  checkRequiredParams(findings, file, source, breadcrumb.params, "현재 위치 경로");
  for (const [name, argument] of Object.entries(
    isObject(breadcrumb.params) ? breadcrumb.params : {}
  )) {
    if (!declared.has(name)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 넘긴 인자 '${name}'를 데이터 출처 '${key}'가 받지 않습니다.`
      });
    }
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `현재 위치 경로가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
  }
}


export function checkDraftFrom(findings, file, spec, { dataSources, dataSourceByKey, screenParams }) {
  const draftFrom = isObject(spec.draftFrom) ? spec.draftFrom : null;
  if (!draftFrom) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 초안 출처 '${draftFrom.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(draftFrom.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `초안 출처 '${draftFrom.dataSourceKey}'가 데이터 출처 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `초안 출처 '${draftFrom.dataSourceKey}'는 shape가 '${source.shape}'입니다. 고치는 대상은 한 건이므로 object여야 합니다.`
    });
  }

  const declared = paramKeys(source);
  checkRequiredParams(findings, file, source, draftFrom.params, "초안 출처");
  for (const [paramName, argument] of Object.entries(draftFrom.params ?? {})) {
    if (!declared.has(paramName)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처에 넘긴 인자 '${paramName}'가 '${draftFrom.dataSourceKey}'에 선언돼 있지 않습니다.`
      });
    }
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처의 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
  }

  // 조각 이름과 칸 이름을 맞춰 본다. 목록의 조각은 다시 항목의 칸과 맞춰 본다.
  const lists = new Map(
    allElementsOf(spec)
      .map(({ element }) => element?.spec)
      .filter((candidate) => isObject(candidate) && candidate.type === "list")
      .map((candidate) => [candidate.fieldKey, candidate])
  );
  const screenFieldKeys = new Set(
    allElementsOf(spec)
      .map(({ element }) => element?.spec)
      .filter((candidate) => isObject(candidate) && FIELD_ELEMENT_TYPES.has(candidate.type))
      .map((candidate) => candidate.fieldKey)
      .filter((key) => typeof key === "string")
  );

  /**
   * `<칸>Name`은 곁에 있는 `<칸>`의 **이름표**다. 그 자체가 칸이 아니다.
   *
   * 고르는 값은 코드로 오는데(`college: 'COL-…'`) 사람에게 보일 것은 이름이다.
   * 서버가 완성된 글을 준다는 규칙에 따라 둘이 함께 오고, 화면은 코드를 값 칸에,
   * 이름을 이름표에 담는다(`FINPLAN01Screen`의 `draftFromRow`가 정한 규칙).
   *
   * **곁에 그 값이 있어야 이름표다.** 이름이 그냥 값인 칸도 있다 — `schoolName`·
   * `orgName`이 그렇고, 그것을 이름표로 오해하면 그 칸이 통째로 빈다.
   */
  const fieldKeys = new Set(
    (Array.isArray(source.fields) ? source.fields : [])
      .map((one) => one?.key)
      .filter((key) => typeof key === "string")
  );
  const isLabelOf = (key) =>
    key.endsWith("Name") && fieldKeys.has(key.slice(0, -"Name".length));

  for (const field of Array.isArray(source.fields) ? source.fields : []) {
    if (typeof field?.key !== "string") {
      continue;
    }
    if (isLabelOf(field.key)) {
      // 이름표는 그 값을 담는 칸이 화면에 있어야 뜻이 있다.
      if (!screenFieldKeys.has(field.key.slice(0, -"Name".length))) {
        findings.push({
          level: "error",
          file,
          message: `초안 출처 '${draftFrom.dataSourceKey}'의 조각 '${field.key}'는 '${field.key.slice(0, -"Name".length)}'의 이름표인데 그 칸이 화면에 없습니다.`
        });
      }
      continue;
    }
    if (!screenFieldKeys.has(field.key)) {
      findings.push({
        level: "error",
        file,
        message: `초안 출처 '${draftFrom.dataSourceKey}'의 조각 '${field.key}'를 받을 칸이 화면에 없습니다. 읽어만 놓고 아무 데도 쓰지 않습니다.`
      });
      continue;
    }
    const list = lists.get(field.key);
    if (!list) {
      continue;
    }
    const itemKeys = new Set(
      (Array.isArray(list.itemFields) ? list.itemFields : [])
        .map((entry) => entry?.spec?.fieldKey)
        .filter((key) => typeof key === "string")
    );
    const nested = new Set(
      (Array.isArray(field.fields) ? field.fields : [])
        .map((entry) => entry?.key)
        .filter((key) => typeof key === "string")
    );
    for (const key of itemKeys) {
      if (!nested.has(key)) {
        findings.push({
          level: "error",
          file,
          message: `목록 '${field.key}'의 칸 '${key}'가 초안 출처 '${draftFrom.dataSourceKey}'의 항목 조각에 없습니다. 고치러 들어와도 그 칸만 늘 비어 있습니다.`
        });
      }
    }
  }
}


// 정해진 단계들과 '지금 어디인지'.
//
// 단계는 명세가 알고 지금 어디인지는 데이터가 안다. 그 둘이 **같은 말을 쓰는지**를
// 여기서 본다 — 어긋나면 줄은 그려지고 어느 단계도 켜지지 않는다. 조용한 어긋남이다.
// 칸 목록이 데이터에서 오는 묶음.
//
// 명세가 칸을 모르므로 검사할 것은 하나뿐이다: **그 출처가 칸을 말하는 출처인가.**
// key·label·placeholder 셋이 칸 하나를 이루고, 하나라도 없으면 화면이 무엇을 그려야
// 할지 알 수 없다. 이름을 화면마다 고르게 하지 않는 이유가 이것이다 — 짝짓기가 다시
// 명세의 일이 되면 칸을 데이터로 옮긴 뜻이 없다.
export function checkFieldSet(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  if (!isObject(dataSources)) {
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }
  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const required of ["key", "label", "placeholder"]) {
    if (!known.has(required)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 칸 목록 출처 '${spec.dataSourceKey}'에 '${required}' 조각이 없습니다. 칸 하나는 key·label·placeholder로 이루어집니다.`
      });
    }
  }
}


export function checkSteps(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;

  const seen = new Set();
  for (const item of Array.isArray(spec.items) ? spec.items : []) {
    if (typeof item?.key !== "string") {
      continue;
    }
    if (seen.has(item.key)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 단계 '${item.key}'가 두 번 나옵니다. 어느 것이 '지금'인지 정할 수 없습니다.`
      });
    }
    seen.add(item.key);
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 단계의 출처 '${spec.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    // 출처 부재는 checkDataSource가 이미 보고한다.
    return;
  }
  const fields = new Set((source.fields ?? []).map((field) => field?.key));
  if (!fields.has(spec.currentField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 currentField '${spec.currentField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
    });
  }
}


// summary·itemList가 가리키는 데이터 출처는 카탈로그에 있어야 하고, 모양이
// 맞아야 한다. summary는 값 묶음 하나(object), itemList는 반복 항목(list)이다.
export function checkDataSource(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const key = spec.dataSourceKey;

  if (typeof key !== "string") {
    // 안쪽 목록은 조회하지 않는다. 항목이 바깥 항목의 조각에서 오므로 출처가 없다.
    if (typeof spec.itemsField === "string") {
      return;
    }
    // 되풀이되는 묶음 안에서는 출처를 다시 적지 않는다. 항목 하나가 곧 그 값이고,
    // 목록이 이미 어디서 오는지 말했다 — 안쪽마다 같은 출처를 되풀이해 적게 하면
    // 둘이 갈릴 자리가 생긴다.
    if (isObject(context.inList) && context.inList.type === "itemList") {
      return;
    }
    // 출처가 없으면 값은 명세에 담긴 예시다. field를 가리킬 수는 없다.
    const withField = (spec.items ?? []).filter((item) => item?.field !== undefined);
    if (
      spec.titleField !== undefined ||
      spec.descriptionField !== undefined ||
      withField.length > 0
    ) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 dataSourceKey 없이 field를 가리킵니다.`
      });
    }
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 데이터 출처 '${key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const source = dataSourceByKey.get(key);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
    });
    return;
  }

  // 조각을 항목으로 받는 목록은 **한 건을 조회한다.** 줄들이 그 한 건 안에 이미
  // 들어 있으므로 출처는 object이고, list를 요구하면 이 꼴이 통째로 막힌다.
  const readsField = spec.type === "itemList" && typeof spec.itemsField === "string";
  const expectedShape =
    !readsField && (spec.type === "itemList" || spec.type === "fieldSet") ? "list" : "object";
  if (source.shape !== expectedShape) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}(${spec.type})는 shape가 '${expectedShape}'인 출처를 써야 하는데 '${key}'는 '${source.shape}'입니다.`
    });
  }

  // 조각을 항목으로 받는 목록은 그 조각이 무엇으로 이루어지는지도 말해야 한다.
  // 없으면 열이 무엇을 가리키는지 견줄 것이 없고, 검사가 조용해진다.
  if (readsField) {
    const nested = (source.fields ?? []).find((field) => field.key === spec.itemsField);
    if (!nested || !Array.isArray(nested.fields)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 가리킨 조각 '${spec.itemsField}'가 데이터 출처 '${key}'에 없거나 fields를 갖지 않습니다. 항목이 무엇으로 이루어지는지 알 수 없습니다.`
      });
    }
  }

  const fieldKeys = new Set((source.fields ?? []).map((field) => field.key));
  const referenced = [
    ...(spec.eyebrowField === undefined ? [] : [spec.eyebrowField]),
    ...(spec.titleField === undefined ? [] : [spec.titleField]),
    ...(spec.descriptionField === undefined ? [] : [spec.descriptionField]),
    // **요약 자체의 색과 그림도 조각을 가리킨다.** 딱지의 것(status[])만 보고
    // 있어서 이 둘은 없는 조각을 가리켜도 조용했다 — 색이 무채색으로 그려지거나
    // 그림이 안 나와도 아무도 그것이 틀렸다고 말하지 않는다.
    ...(spec.toneField === undefined ? [] : [spec.toneField]),
    ...(spec.iconField === undefined ? [] : [spec.iconField]),
    // 상태 딱지는 글과 색 이름을 따로 가리킨다. 색만 없으면 딱지가 무채색으로
    // 그려지고 아무도 그것이 틀렸다고 말하지 않는다.
    //
    // **딱지는 여럿이다.** 한 자리에 둘 붙는 곳이 있어(OPS-MEET-07·04B) 스키마가
    // 배열인데, 여기는 오랫동안 isObject로 물었다 — 배열은 isObject가 아니므로
    // 이 판정은 **한 번도 돈 적이 없다**. 딱지가 없는 출처를 가리켜도 조용했다.
    ...(Array.isArray(spec.status) ? spec.status : [])
      .flatMap((badge) => [badge?.field, badge?.toneField])
      .filter((field) => typeof field === "string"),
    ...(spec.items ?? []).map((item) => item?.field).filter((field) => field !== undefined)
  ];
  for (const field of referenced) {
    if (!fieldKeys.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
      });
    }
  }
}


// 조회에 넘기는 값이 어디서 오는지 검사한다. 인자 이름은 카탈로그가, 그 값을
// 담은 필드는 화면이 갖는다 — 둘 중 하나만 틀려도 조용히 안 걸러진다.
export function checkQueryParams(findings, context) {
  const { params, dataSourceKey } = context.element.spec;
  checkArgumentMap(findings, context, params, dataSourceKey);
}


// 줄 전체의 색 이름도 실제로 있는 조각이어야 한다. 없으면 아무 줄도 표시되지
// 않고 아무도 말하지 않는다 - 열의 색 이름을 보는 것과 같은 이유다.
/**
 * 데이터가 허락할 때만 그리는 자리(drawnWhen).
 *
 * 그리는 조건을 명세가 적지 않고 **데이터가 답한다**. 그래서 검사할 것은 셋뿐이다 —
 * 그 출처가 카탈로그에 있는가, 그 조각이 그 출처에 있는가, 넘긴 인자가 선언돼 있는가.
 * '언제 참인가'는 서버의 것이라 여기서 묻지 않는다.
 */
export function checkDrawnWhen(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const drawnWhen = element?.drawnWhen;
  if (!isObject(drawnWhen)) {
    return;
  }
  const where = `${elementLabel(element, index)}의 drawnWhen`;
  if (!dataSources) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${where}의 출처 '${drawnWhen.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(drawnWhen.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${drawnWhen.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  const sourceFields = new Set((source.fields ?? []).map((field) => field?.key));
  if (!sourceFields.has(drawnWhen.field)) {
    findings.push({
      level: "error",
      file,
      message: `${where}이 가리킨 조각 '${drawnWhen.field}'가 데이터 출처 '${drawnWhen.dataSourceKey}'에 없습니다.`
    });
  }
  checkRequiredParams(
    findings, context.file, source, drawnWhen.params,
    `그릴지 정하는 조회 '${drawnWhen.dataSourceKey}'`
  );
  checkArgumentValues(findings, context, drawnWhen.params, {
    declared: paramKeys(source),
    where: `데이터 출처 '${drawnWhen.dataSourceKey}'`
  });
}

/** 화면 제목이 읽는 데이터 출처와 인자의 검사 결과. */
export function collectScreenTitleSourceFindings({ file, spec, dataSources, dataSourceByKey }) {
  const findings = [];
  // 제목이 데이터에서 오는 화면. 요소가 아니라 화면 자체가 값을 읽으므로
  // 요소 검사가 지나치고, 지나치면 없는 조각을 가리켜도 제목만 조용히 빈다.
  const titleFrom = isObject(spec.meta) ? spec.meta.titleFrom : null;
  if (isObject(titleFrom)) {
    const screenParamKeys = new Set(
      (Array.isArray(spec.params) ? spec.params : [])
        .map((param) => param?.key)
        .filter((key) => typeof key === "string")
    );
    const source = dataSourceByKey.get(titleFrom.dataSourceKey);
    if (!isObject(dataSources)) {
      findings.push({
        level: "warning",
        file,
        message: `data-sources.json이 없어 화면 제목의 출처 '${titleFrom.dataSourceKey}'를 확인하지 못했습니다.`
      });
    } else if (!source) {
      findings.push({
        level: "error",
        file,
        message: `화면 제목의 데이터 출처 '${titleFrom.dataSourceKey}'가 카탈로그에 없습니다.`
      });
    } else {
      if (source.shape !== "object") {
        findings.push({
          level: "error",
          file,
          message: `화면 제목의 데이터 출처 '${titleFrom.dataSourceKey}'는 shape가 '${source.shape}'입니다. 제목은 값 하나이므로 object여야 합니다.`
        });
      }
      const sourceFields = new Set((source.fields ?? []).map((field) => field?.key));
      if (!sourceFields.has(titleFrom.field)) {
        findings.push({
          level: "error",
          file,
          message: `화면 제목이 가리킨 조각 '${titleFrom.field}'가 데이터 출처 '${titleFrom.dataSourceKey}'에 없습니다.`
        });
      }
      const declared = paramKeys(source);
      checkRequiredParams(findings, file, source, titleFrom.params, "화면 제목");
      for (const [paramName, argument] of Object.entries(titleFrom.params ?? {})) {
        if (!declared.has(paramName)) {
          findings.push({
            level: "error",
            file,
            message: `화면 제목이 넘긴 조회 인자 '${paramName}'가 데이터 출처 '${titleFrom.dataSourceKey}'에 선언돼 있지 않습니다.`
          });
        }
        const screenParam = isObject(argument) ? argument.screenParam : undefined;
        if (typeof screenParam === "string" && !screenParamKeys.has(screenParam)) {
          findings.push({
            level: "error",
            file,
            message: `화면 제목의 조회 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
          });
        }
      }
    }
  }
  return findings;
}
