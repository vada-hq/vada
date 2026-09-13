import { elementLabel, isObject, paramKeys } from "./spec-validation-values.mjs";
import { checkArgumentMap, checkArgumentValues, checkRequiredParams } from "./source-parameters.mjs";


export function checkListReferences(findings, context) {
  const { file, element, index, fieldKeys } = context;
  const { initialItems, minItems, maxItems } = element.spec;

  if (typeof minItems === "number" && typeof maxItems === "number" && minItems > maxItems) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 minItems(${minItems})가 maxItems(${maxItems})보다 큽니다.`
    });
  }

  if (isObject(initialItems) && typeof initialItems.fieldKey === "string") {
    if (!fieldKeys.has(initialItems.fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 initialItems가 참조한 fieldKey '${initialItems.fieldKey}'가 화면에 없습니다.`
      });
    }
    const counts = Object.values(
      isObject(initialItems.byValue) ? initialItems.byValue : {}
    );
    for (const items of counts) {
      if (Array.isArray(items) && typeof maxItems === "number" && items.length > maxItems) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 초기 항목 ${items.length}개가 maxItems(${maxItems})를 넘습니다.`
        });
      }
    }
  }
}


// 항목이 여러 칸을 갖는 목록.
//
// 항목 머리에 그리는 이름은 항목의 칸 하나다. 그것을 가리키지 않으면 화면은 머리에
// 무엇을 적을지 모르고, 순번만 남는다.
export function checkListItemFields(findings, context) {
  const { file, element, index } = context;
  const { itemFields, itemTitleFieldKey, itemActions } = element.spec;

  if (!Array.isArray(itemFields)) {
    if (typeof itemTitleFieldKey === "string") {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}에 itemTitleFieldKey가 있는데 itemFields가 없습니다. 가리킬 칸이 없습니다.`
      });
    }
    return;
  }

  const itemKeys = new Set(
    itemFields
      .map((field) => field?.spec?.fieldKey)
      .filter((key) => typeof key === "string")
  );

  if (typeof itemTitleFieldKey !== "string") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}에 itemTitleFieldKey가 없습니다. 항목 머리에 그릴 이름이 어느 칸의 값인지 정해야 합니다.`
    });
  } else if (!itemKeys.has(itemTitleFieldKey)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 itemTitleFieldKey '${itemTitleFieldKey}'가 itemFields에 없습니다.`
    });
  }

  // 이름도 항목의 칸이므로, 그 칸을 고치는 것이 곧 이름을 고치는 것이다.
  if (Array.isArray(itemActions) && itemActions.includes("rename")) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}는 itemFields가 있으므로 itemActions에 'rename'을 쓸 수 없습니다. 이름은 '${itemTitleFieldKey}' 칸이고, 그 칸을 고치는 것이 이름을 고치는 것입니다.`
    });
  }
}


/**
 * 더할 항목을 고르는 출처(list.candidatesSource).
 *
 * 이 자리가 없던 동안 화면이 출처 이름을 코드에 박아 읽었다 — 명세만 읽는 사람은
 * 그 화면이 그 출처를 쓴다는 것을 알 길이 없었다.
 */
export function checkCandidatesSource(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const candidates = element?.spec?.candidatesSource;
  if (!isObject(candidates)) {
    return;
  }
  const where = `${elementLabel(element, index)}의 candidatesSource`;
  if (!dataSources) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${where}의 출처 '${candidates.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }
  const source = dataSourceByKey.get(candidates.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${candidates.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "list") {
    findings.push({
      level: "error",
      file,
      message: `${where}의 데이터 출처 '${candidates.dataSourceKey}'는 shape가 '${source.shape}'입니다. 고를 후보이므로 list여야 합니다.`
    });
  }
  checkRequiredParams(
    findings, context.file, source, candidates.params,
    `고를 것을 가져오는 조회 '${candidates.dataSourceKey}'`
  );
  checkArgumentValues(findings, context, candidates.params, {
    declared: paramKeys(source),
    where: `데이터 출처 '${candidates.dataSourceKey}'`
  });
}


export function checkRowToneField(findings, context) {
  checkRowField(findings, context, "rowToneField", "줄 색 이름 조각");
  // 줄 앞의 표시를 정하는 조각. 없는 것을 가리키면 그림이 안 나오는데, 그림이
  // 없는 것과 조각이 없는 것은 화면에서 똑같이 보인다.
  checkRowField(findings, context, "iconField", "줄 앞 표시를 정하는 조각");
}


function checkRowField(findings, context, prop, what) {
  const { file, element, index, dataSourceByKey } = context;
  const spec = element.spec;
  if (typeof spec?.[prop] !== "string" || typeof spec.dataSourceKey !== "string") {
    return;
  }
  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }
  // 되풀이되는 묶음은 항목의 조각이 안쪽에 있다. 바깥에서 찾으면 늘 없다고 한다.
  const fields =
    typeof spec.itemsField === "string"
      ? ((source.fields ?? []).find((field) => field.key === spec.itemsField)?.fields ?? [])
      : (source.fields ?? []);
  if (!fields.some((field) => field.key === spec[prop])) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 ${what} '${spec[prop]}'가 '${spec.dataSourceKey}'에 없습니다.`
    });
  }
}


// 옮길 수 있는 목록은 **자리를 잃은 사람이 어디 모이는지**를 가리킨다. 그 곳이
// 실제로 있는 목록 출처가 아니면, 뺀 사람이 어디로 갔는지 아무도 답할 수 없다.
export function checkItemMovePool(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const move = element.spec?.itemMove;
  if (!isObject(move)) {
    return;
  }
  const pool = dataSourceByKey.get(move.poolSourceKey);
  if (!pool) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가리킨 미배정 출처 '${move.poolSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (pool.shape !== "list") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 미배정 출처 '${move.poolSourceKey}'는 목록이어야 합니다. 자리 없는 사람이 여럿일 수 있습니다.`
    });
  }
}


// 안쪽 목록의 섹션 제목이 바깥 항목에서 온다면(titleField), 그 조각이 실제로
// 바깥 항목에 있어야 한다. 없으면 제목만 빈 채로 그려지고 아무도 말하지 않는다 —
// 열이 가리킨 조각을 보는 것과 같은 이유다.
export function checkNestedListTitleField(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const spec = element.spec;
  if (typeof spec?.titleField !== "string" || typeof spec.itemsField !== "string") {
    return;
  }
  const outer = isObject(context.inList) ? dataSourceByKey.get(context.inList.dataSourceKey) : null;
  if (!outer) {
    return;
  }
  if (!(outer.fields ?? []).some((field) => field.key === spec.titleField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 제목이 가리킨 조각 '${spec.titleField}'가 바깥 항목에 없습니다.`
    });
  }
}


// 표로 그려지는 목록의 열 머리.
//
// 열 머리는 그려지는 글이라 명세가 갖는데, 그 열에 무엇이 오는지는 데이터 출처의
// 조각 이름이다. 둘이 어긋나면 표는 그려지고 칸만 빈다 — 조용한 어긋남이라 여기서
// 본다. 한 조각이 두 열에 오면 어느 칸에 그릴지 화면이 정하게 되므로 그것도 막는다.
export function checkListColumns(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const columns = spec.columns;

  if (!Array.isArray(columns) || !isObject(dataSources)) {
    return;
  }

  // 항목이 조각에서 오면 열도 그 조각의 fields로 견줘야 한다. 조각을 어디서 찾는지가
  // 둘로 갈린다 — 출처를 함께 적었으면 그 출처의 응답 안이고, 아니면 바깥 항목이다.
  if (typeof spec.itemsField === "string") {
    const outer =
      typeof spec.dataSourceKey === "string"
        ? dataSourceByKey.get(spec.dataSourceKey)
        : isObject(context.inList)
          ? dataSourceByKey.get(context.inList.dataSourceKey)
          : null;
    if (!outer) {
      return;
    }
    const nested = (outer.fields ?? []).find((field) => field.key === spec.itemsField);
    if (!nested || !Array.isArray(nested.fields)) {
      // 출처를 함께 적은 꼴은 checkDataSource가 이미 말한다 — 두 번 말하지 않는다.
      if (typeof spec.dataSourceKey !== "string") {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}가 가리킨 조각 '${spec.itemsField}'가 바깥 항목에 없거나 fields를 갖지 않습니다. 안쪽 목록의 항목은 그 조각에서 옵니다.`
        });
      }
      return;
    }
    const knownInner = new Set(nested.fields.map((field) => field.key));
    columns.forEach((column, at) => {
      for (const name of [...(column?.fields ?? []), column?.toneField].filter(
        (candidate) => typeof candidate === "string"
      )) {
        if (!knownInner.has(name)) {
          findings.push({
            level: "error",
            file,
            message: `${elementLabel(element, index)}의 ${at + 1}번째 열이 가리킨 조각 '${name}'가 '${spec.itemsField}'에 없습니다.`
          });
        }
      }
    });
    return;
  }

  const source = dataSourceByKey.get(spec.dataSourceKey);
  if (!source) {
    return;
  }

  // 묶음으로 오는 목록에서는 열이 묶음 **안**의 항목을 말한다. 바깥 행은 묶음
  // 자신이고, 그것을 가리키는 것은 group.headerFields다. 여기서 바깥 조각으로
  // 견주면 열이 전부 '없는 조각'으로 보인다.
  const itemsField =
    isObject(spec.group) && typeof spec.group.itemsField === "string"
      ? (source.fields ?? []).find((field) => field.key === spec.group.itemsField)
      : null;
  if (isObject(spec.group) && !itemsField) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 묶음 조각 '${spec.group.itemsField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
    });
    return;
  }
  if (itemsField && !Array.isArray(itemsField.fields)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 묶음 조각 '${spec.group.itemsField}'에 fields가 없습니다. 묶음에 든 항목이 무엇으로 이루어지는지 알 수 없습니다.`
    });
    return;
  }

  const fieldsOfItem = itemsField ? itemsField.fields : (source.fields ?? []);
  const known = new Set(fieldsOfItem.map((field) => field.key));
  const seen = new Map();
  // 머리글이 그려지지 않는 목록은 label이 없다. 그때도 어느 열인지 말할 수 있어야
  // 오류가 쓸모 있으므로 자리로 부른다.
  const nameOf = (column, at) =>
    typeof column?.label === "string" ? `'${column.label}'` : `${at + 1}번째`;

  columns.forEach((column, at) => {
    for (const field of column?.fields ?? []) {
      if (!known.has(field)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 ${nameOf(column, at)} 열이 가리킨 조각 '${field}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
        });
        continue;
      }
      const owner = seen.get(field);
      if (owner !== undefined) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 조각 '${field}'가 ${owner} 열과 ${nameOf(column, at)} 열 둘에 옵니다. 한 조각은 한 열에만 올 수 있습니다.`
        });
        continue;
      }
      seen.set(field, nameOf(column, at));
    }
  });

  // 색 이름은 그려지는 글이 아니다. 딱지의 글은 fields가, 그 색은 toneField가
  // 가리킨다 — 둘을 한 열에 섞으면 색 이름이 사람에게 그대로 보인다.
  columns.forEach((column, at) => {
    const toneField = column?.toneField;
    if (typeof toneField !== "string") {
      return;
    }
    if (!known.has(toneField)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 ${nameOf(column, at)} 열이 가리킨 색 이름 조각 '${toneField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
      });
      return;
    }
    if (seen.has(toneField)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조각 '${toneField}'가 색 이름이면서 ${seen.get(toneField)} 열에 그려집니다. 색 이름은 어느 열에도 오지 않습니다.`
      });
    }
  });

  // 묶음의 머리는 바깥 행의 조각을 그린다. 열과 가리키는 곳이 반대다.
  const outer = new Set((source.fields ?? []).map((field) => field.key));
  const headerFields = isObject(spec.group) ? spec.group.headerFields : undefined;
  (Array.isArray(headerFields) ? headerFields : []).forEach((column, at) => {
    for (const name of [...(column?.fields ?? []), column?.toneField].filter(
      (candidate) => typeof candidate === "string"
    )) {
      if (!outer.has(name)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 묶음 머리 ${nameOf(column, at)} 조각 '${name}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다. 머리는 묶음 자신을 가리킵니다.`
        });
      }
    }
    if (typeof column?.fieldKey === "string") {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 묶음 머리에 고치는 칸(fieldKey)이 있습니다. 묶음의 머리는 읽는 자리입니다.`
      });
    }
  });
}


// 쪽으로 나뉜 목록.
//
// 목록은 한 쪽만큼만 받아 오므로 총 몇 건인지·몇 쪽인지를 자기가 말할 수 없다.
// 그 둘을 아는 출처가 따로 있고, 셋이 어긋나면 쪽 버튼이 그려지긴 하는데 늘 한
// 쪽뿐이거나 없는 쪽으로 넘어간다 — 조용한 어긋남이라 여기서 본다.
export function checkListPaging(findings, context) {
  const { file, element, index, dataSources, dataSourceByKey } = context;
  const spec = element.spec;
  const paging = spec.paging;

  if (!isObject(paging)) {
    return;
  }

  if (!isObject(dataSources)) {
    findings.push({
      level: "warning",
      file,
      message: `data-sources.json이 없어 ${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'를 확인하지 못했습니다.`
    });
    return;
  }

  // 쪽 번호는 목록이 스스로 넘기는 인자다. 출처가 그것을 받지 않으면 쪽을 넘겨도
  // 같은 것이 돌아온다.
  const listSource = dataSourceByKey.get(spec.dataSourceKey);
  if (listSource && !paramKeys(listSource).has(paging.pageParam)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 인자 '${paging.pageParam}'가 데이터 출처 '${spec.dataSourceKey}'에 선언돼 있지 않습니다.`
    });
  }
  if (isObject(spec.params) && paging.pageParam in spec.params) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 쪽 인자 '${paging.pageParam}'를 params에도 적었습니다. 쪽 번호는 목록 자신이 갖습니다.`
    });
  }

  const source = dataSourceByKey.get(paging.dataSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (source.shape !== "object") {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 쪽 출처 '${paging.dataSourceKey}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
    });
    return;
  }

  checkArgumentMap(findings, context, paging.params, paging.dataSourceKey);

  const known = new Set((source.fields ?? []).map((field) => field.key));
  for (const [what, field] of [
    ["총 건수", paging.totalNoteField],
    ["쪽 수", paging.pageCountField]
  ]) {
    if (typeof field === "string" && !known.has(field)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 ${what} 조각 '${field}'가 쪽 출처 '${paging.dataSourceKey}'에 없습니다.`
      });
    }
  }
}
