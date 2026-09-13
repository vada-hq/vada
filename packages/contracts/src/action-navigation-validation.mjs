import { elementLabel, isObject, paramKeys } from "./spec-validation-values.mjs";
import { checkArgumentValues, checkRequiredParams } from "./source-parameters.mjs";

// 인자 없이 열렸을 때 뭐라고 할지.
//
// 지금까지 그 문장은 화면마다 코드에 있었다. 명세에 없는 카피이므로 대조기도
// 준수 검사도 보지 않았고, 화면마다 다른 말을 했다 — 어떤 화면은 '이 화면은
// eventId가 있어야 열립니다'라 했고 어떤 화면은 명세의 내부 설명을 그대로
// 뿌렸다. 없어도 되는 인자는 없는 것이 사고가 아니므로 이 글도 없다.
export function checkParamMissingNotes(findings, file, spec) {
  for (const param of Array.isArray(spec.params) ? spec.params : []) {
    if (!isObject(param) || typeof param.key !== "string") {
      continue;
    }
    const optional = param.optional === true;
    const note = param.missingNote;
    if (optional && note !== undefined) {
      findings.push({
        level: "error",
        file,
        message: `인자 '${param.key}'는 없어도 되는데 없을 때의 글(missingNote)을 갖습니다. 그 자리는 그려지지 않습니다.`
      });
      continue;
    }
    if (!optional && typeof note !== "string") {
      findings.push({
        level: "error",
        file,
        message: `인자 '${param.key}'가 없을 때 사람에게 뭐라고 할지(missingNote)가 없습니다. 적지 않으면 구현이 지어냅니다.`
      });
    }
  }
}

// 가져갈 수 있는 값은 실제로 있는 조각이어야 한다. 없으면 눌러도 빈 것이 복사되고
// 아무도 말하지 않는다.
export function checkCopyAction(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const action = element.spec?.action;
  if (!isObject(action) || action.type !== "copy") {
    return;
  }
  const source = dataSourceByKey.get(action.copySourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가져가려는 출처 '${action.copySourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (!(source.fields ?? []).some((field) => field.key === action.copyField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 가져가려는 조각 '${action.copyField}'가 '${action.copySourceKey}'에 없습니다.`
    });
  }
}

export function checkOnSuccessParams(findings, context) {
  const { file, element, index, screens } = context;
  const action = element.spec?.action;
  const onSuccess = action?.onSuccess;
  if (!isObject(onSuccess) || typeof onSuccess.navigate !== "string") {
    return;
  }
  const target = screens.find((screen) => screen.spec?.screenId === onSuccess.navigate);
  if (!target) {
    return;
  }
  const given = new Set(Object.keys(isObject(onSuccess.params) ? onSuccess.params : {}));
  for (const param of Array.isArray(target.spec?.params) ? target.spec.params : []) {
    if (param?.optional === true || given.has(param?.key)) {
      continue;
    }
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 보내고 나서 '${onSuccess.navigate}'로 가는데 그 화면이 필수로 받는 인자 '${param?.key}'를 아무도 주지 않습니다.`
    });
  }
}

// 줄마다 가는 곳이 다른 이동. 데이터가 화면 id를 직접 주면 검증기가 확인할 수
// 없으므로, 데이터는 열쇠만 주고 갈 곳은 명세가 든다.
export function checkBranchingTargets(findings, context) {
  const { file, element, index, screenIds } = context;
  for (const key of ["action", "itemAction", "emptyAction"]) {
    const action = element.spec?.[key];
    if (!isObject(action) || !Array.isArray(action.targets)) {
      continue;
    }
    for (const branch of action.targets) {
      if (!screenIds.has(branch.targetScreenId)) {
        findings.push({
          level: "warning",
          file,
          message: `${elementLabel(element, index)}의 갈림길이 가리킨 화면 '${branch.targetScreenId}'의 명세가 없습니다.`
        });
      }
    }
  }
}

// 받아 갈 파일도 실제로 있는 조각을 가리켜야 한다. copy와 같은 검사인데 대상이
// 다르다. 저것은 화면에 그려진 값이고 이것은 서버가 가진 파일이다.
export function checkDownloadAction(findings, context) {
  const { file, element, index, dataSourceByKey } = context;
  const action = element.spec?.action;
  if (!isObject(action) || action.type !== "download") {
    return;
  }
  const source = dataSourceByKey.get(action.downloadSourceKey);
  if (!source) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 받아 가려는 출처 '${action.downloadSourceKey}'가 카탈로그에 없습니다.`
    });
    return;
  }
  if (!(source.fields ?? []).some((field) => field.key === action.downloadField)) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}가 받아 가려는 조각 '${action.downloadField}'가 '${action.downloadSourceKey}'에 없습니다.`
    });
  }
}

// 이동하면서 넘기는 인자.
//
// 화면이 인자를 받으면(screen.params) 누군가는 그 값을 줘야 한다. 주지 않으면
// 대상 화면은 오류 카드를 띄우고 끝나는데, **그 사실이 명세를 읽어서는 보이지
// 않는다** — 이동은 성공하고 화면만 비기 때문이다. 그래서 여기서 본다.
export function checkNavigateParams(findings, context) {
  const {
    file,
    element,
    index,
    dataSourceByKey,
    fieldKeys,
    screenParams,
    screenParamsById,
    requiredParamsById,
    mutationByKey
  } = context;
  const spec = element.spec;

  const actions = [
    { at: "action", action: spec.action },
    { at: "itemAction", action: spec.itemAction },
    // 비었을 때 권하는 단추도 인자를 넘긴다. 그 자리에는 **눌린 줄이 없으므로**
    // itemField를 가리키면 아래에서 오류가 난다(rowFields === null).
    { at: "emptyAction", action: spec.emptyAction }
  ].filter(({ action }) => isObject(action));

  for (const { at, action } of actions) {
    const params = action.params;
    const target = action.targetScreenId;
    const targetParams = screenParamsById?.get(target) ?? null;
    const targetRequired = requiredParamsById?.get(target) ?? null;
    const label = elementLabel(element, index);

    // **보내는 자리도 인자를 받는다.** 오랫동안 인자는 '다음 화면에 넘기는 것'뿐인 줄
    // 알고 제출에는 막아 두었는데, 변이도 자리에 인자가 박혀 있다
    // (`/api/ops/meetings/{meetingId}/hosts/{memberId}`). 막아 둔 탓에 **누구에게 주는지
    // 말할 길이 없었고**, 21곳 중 20곳은 화면 인자와 이름이 우연히 같아 도는 중이었다.
    // **없는 것도 본다.** 처음에는 params가 있을 때만 봤는데, 그러면 아예 안 적은
    // 자리가 조용하다 — 그것이 바로 이 검사가 잡으려던 모양이다(누구에게 주는지
    // 말하지 않던 진행 권한 부여가 그랬다).
    if (action.type === "submit") {
      const mutation = mutationByKey?.get(action.mutationKey) ?? null;
      if (mutation) {
        checkArgumentValues(findings, context, params, {
          declared: paramKeys(mutation),
          where: `제출 계약 '${action.mutationKey}'`
        });
        checkRequiredParams(findings, file, mutation, params, `${label}의 제출 '${action.mutationKey}'`);
      }
      continue;
    }

    if (isObject(params) && action.type !== "navigate") {
      findings.push({
        level: "error",
        file,
        message: `${label}의 ${at}이 이동하지 않는데 인자를 넘깁니다(type=${action.type}). 받을 화면이 없습니다.`
      });
      continue;
    }

    // 항목의 조각은 눌린 행이 있는 자리에서만 가리킬 것이 있다.
    // 눌린 줄이 무엇인지. **묶인 목록에서는 묶음이 아니라 그 안의 항목이다** —
    // 회의 목록은 행사별 묶음으로 오고 눌리는 것은 묶음 안의 회의 한 건이다.
    // 겉의 조각만 보면 항목의 조각을 가리켰을 때 '없다'고 잘못 말한다.
    const listSource = dataSourceByKey.get(spec.dataSourceKey);
    const groupedItemsField = spec.group?.itemsField;
    const rowSourceFields =
      typeof groupedItemsField === "string"
        ? ((listSource?.fields ?? []).find((f) => f?.key === groupedItemsField)?.fields ?? [])
        : (listSource?.fields ?? []);
    const rowFields =
      at === "itemAction" && spec.type === "itemList"
        ? new Set(rowSourceFields.map((f) => f?.key))
        : null;

    for (const [paramName, argument] of Object.entries(isObject(params) ? params : {})) {
      if (targetParams && !targetParams.has(paramName)) {
        findings.push({
          level: "error",
          file,
          message: `${label}이 이동하며 넘긴 인자 '${paramName}'를 대상 화면 '${target}'이 받지 않습니다(그 화면의 params에 없습니다).`
        });
      }
      if (!isObject(argument)) {
        continue;
      }
      if (typeof argument.fieldKey === "string" && !fieldKeys.has(argument.fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${label}의 이동 인자 '${paramName}'가 참조한 fieldKey '${argument.fieldKey}'가 화면에 없습니다.`
        });
      }
      if (typeof argument.screenParam === "string" && !screenParams.has(argument.screenParam)) {
        findings.push({
          level: "error",
          file,
          message: `${label}의 이동 인자 '${paramName}'가 화면 인자 '${argument.screenParam}'를 가리키는데 화면의 params에 없습니다.`
        });
      }
      // 이 요소가 읽는 출처의 조각. 그 출처에 없으면 넘어가는 값이 빈 채로 간다.
      if (typeof argument.sourceField === "string") {
        const own = dataSourceByKey.get(spec.dataSourceKey);
        if (!own) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 이 요소가 읽는 출처의 조각을 가리키는데 이 요소에는 출처가 없습니다.`
          });
        } else if (!(own.fields ?? []).some((f) => f?.key === argument.sourceField)) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 가리킨 조각 '${argument.sourceField}'가 데이터 출처 '${spec.dataSourceKey}'에 없습니다.`
          });
        }
      }
      if (typeof argument.itemField === "string") {
        if (rowFields === null) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 항목의 조각(itemField)을 가리키는데 이 자리에는 눌린 항목이 없습니다. 항목의 조각은 itemList의 itemAction에서만 쓸 수 있습니다.`
          });
        } else if (rowFields.size > 0 && !rowFields.has(argument.itemField)) {
          findings.push({
            level: "error",
            file,
            message: `${label}의 이동 인자 '${paramName}'가 항목의 조각 '${argument.itemField}'를 가리키는데 데이터 출처 '${spec.dataSourceKey}'에 그 조각이 없습니다.`
          });
        }
      }
    }

    // 대상이 받는데 아무도 주지 않으면 그 화면은 열리자마자 비어 있다.
    if (action.type === "navigate" && targetRequired) {
      const given = new Set(Object.keys(isObject(params) ? params : {}));
      const missing = [...targetRequired].filter((name) => !given.has(name));
      if (missing.length > 0) {
        findings.push({
          level: "error",
          file,
          message: `${label}이 화면 '${target}'으로 이동하는데 그 화면이 받는 인자 ${missing.map((name) => `'${name}'`).join(", ")}를 넘기지 않습니다. 넘기지 않으면 그 화면은 무엇을 보여줄지 알 수 없습니다.`
        });
      }
    }
  }
}

export function collectElementTargetFindings({ file, element, index, screenIds }) {
  const findings = [];
  const spec_ = element.spec;
  // navigate의 targetScreenId와 submit 성공 후 이동은 같은 규칙으로 검사한다.
  for (const targetScreenId of [
    spec_.action?.targetScreenId,
    spec_.action?.onSuccess?.navigate,
    spec_.itemAction?.targetScreenId,
    spec_.selection?.action?.targetScreenId
  ]) {
    if (
      typeof targetScreenId === "string" &&
      !screenIds.has(targetScreenId)
    ) {
      findings.push({
        level: "warning",
        file,
        message: `${elementLabel(element, index)}의 이동 대상 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
      });
    }
  }
  return findings;
}

export function collectFlowFindings({ flows, flowsFile, screenIds }) {
  const findings = [];
  // 흐름 카탈로그: 참조한 화면의 명세 존재와 단일 멤버십(단계 표시의 유일성)을 검사한다.
  if (isObject(flows) && Array.isArray(flows.flows)) {
    const flowKeysByScreen = new Map();
    for (const flow of flows.flows) {
      if (!isObject(flow) || !Array.isArray(flow.screens)) {
        continue;
      }
      for (const step of flow.screens) {
        const screenId = step?.screenId;
        if (typeof screenId !== "string") {
          continue;
        }
        if (!screenIds.has(screenId)) {
          findings.push({
            level: "warning",
            file: flowsFile,
            message: `흐름 '${flow.key}'의 화면 '${screenId}' 명세가 아직 없습니다.`
          });
        }
        const owners = flowKeysByScreen.get(screenId) ?? [];
        owners.push(flow.key);
        flowKeysByScreen.set(screenId, owners);
      }
    }
    for (const [screenId, owners] of flowKeysByScreen) {
      if (owners.length > 1) {
        findings.push({
          level: "error",
          file: flowsFile,
          message: `화면 '${screenId}'가 여러 흐름(${owners.join(", ")})에 속합니다. 단계 표시가 모호해집니다.`
        });
      }
    }
  }
  return findings;
}
