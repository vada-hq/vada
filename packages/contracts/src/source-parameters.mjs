import { elementLabel, isObject, paramKeys } from "./spec-validation-values.mjs";


/**
 * **열쇠를 빠뜨리고 부르지 않았는가.**
 *
 * 카탈로그가 인자마다 '부르는 쪽이 늘 넘기는가'를 갖고 있다. 빠뜨리면 서버는
 * 거르지 않은 전부를 주고, 화면은 그것이 걸러진 것인 줄 알고 그린다 — 남의 것이
 * 섞여 그려지는데 아무도 말하지 않는다.
 *
 * 이 판정을 짐작으로 세우지 않았다. 값이 어디서 오는지가 답한다 — 경로에 박힌 것,
 * 주소가 실어 온 것, 명세가 박은 값, 눌린 항목은 빌 수가 없고, 화면의 칸에서
 * 오는 것은 그 칸이 반드시 채우는 칸일 때만 늘 채워진다.
 */
export function checkRequiredParams(findings, file, source, params, where) {
  const given = isObject(params) ? params : {};
  for (const param of Array.isArray(source?.params) ? source.params : []) {
    checkFixedValueType(findings, file, param, given[param?.key], where);
    if (param?.required !== true) continue;
    // **경로에 박힌 것도 넘기는 쪽이 준다.** 한동안 여기서 건너뛰었는데, 그것은
    // 주소를 서버가 만든다는 착각이었다 — 주소를 만드는 것은 부르는 쪽이고,
    // `{meetingId}`에 무엇을 넣을지는 이 params가 말한다. 건너뛰는 동안 **130자리가
    // 검사 없이 지나갔고**, 그 자리가 하필 가장 중요한 인자들이다.
    if (param.key in given) continue;
    findings.push({
      level: "error",
      file,
      message: `${where}가 반드시 넘겨야 하는 인자 '${param.key}'를 넘기지 않았습니다(${param.description}).`
    });
  }
}


/**
 * **명세가 박은 값이 선언한 종류와 맞는가.**
 *
 * 인자가 값의 종류를 갖게 됐는데 보는 곳이 없으면 그 선언은 장식이다. 실제로 하나가
 * 걸렸다 — 참거짓 인자에 `"y"`를 넘기고 있었다. 응답 쪽의 `''`/`'y'`는 참거짓으로
 * 고쳤는데 **요청 쪽에 그대로 남아 있었고**, 받는 쪽은 그 글자를 어떻게 읽을지
 * 명세 어디서도 알 수 없었다.
 *
 * 조회 문자열은 글로 실려 가므로 여기서 보는 것은 **그 글이 선언한 종류로 읽히는가**다.
 */
function checkFixedValueType(findings, file, param, argument, where) {
  const value = isObject(argument) ? argument.value : undefined;
  if (typeof value !== "string" || typeof param?.valueType !== "string") return;
  const readable =
    param.valueType === "string" ||
    (param.valueType === "boolean" && (value === "true" || value === "false")) ||
    (param.valueType === "number" && value.trim() !== "" && Number.isFinite(Number(value)));
  if (readable) return;
  findings.push({
    level: "error",
    file,
    message: `${where}의 인자 '${param.key}'는 ${param.valueType}인데 명세가 박은 값이 '${value}'입니다.`
  });
}


// 조회하며 넘기는 인자 한 묶음. 목록·요약의 params, 선택지 개수의 params, 그리고
// 선택지 자체의 params가 같은 것이라 판정도 한 곳이다 — 인자의 출처가 늘면 세 자리가
// 함께 늘어야 한다.
export function checkArgumentMap(findings, context, params, dataSourceKey) {
  const { dataSources, dataSourceByKey } = context;
  const source = isObject(dataSources) ? dataSourceByKey.get(dataSourceKey) : null;
  checkArgumentValues(findings, context, params, {
    declared: source ? paramKeys(source) : null,
    where: `데이터 출처 '${dataSourceKey}'`
  });
  if (source) {
    checkRequiredParams(
      findings, context.file, source, params,
      `${elementLabel(context.element, context.index)}의 데이터 출처 '${dataSourceKey}' 조회`
    );
  }
}


// 인자 하나하나가 가리키는 곳이 실제로 있는가. 무엇이 그 인자를 받는지(declared)는
// 부르는 쪽이 안다 — 데이터 출처일 수도 선택지 출처일 수도 있다.
export function checkArgumentValues(findings, context, params, { declared, where }) {
  const { file, element, index, fieldKeys, screenParams } = context;

  if (!isObject(params)) {
    return;
  }

  for (const [paramName, argument] of Object.entries(params)) {
    if (declared && !declared.has(paramName)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 넘긴 조회 인자 '${paramName}'가 ${where}에 선언돼 있지 않습니다.`
      });
    }
    // 고정값(value)은 명세가 정한 것이라 참조할 필드가 없다.
    const fieldKey = isObject(argument) ? argument.fieldKey : argument;
    if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
      });
    }
    // 화면이 밖에서 받은 인자. 선언하지 않은 것을 가리키면 상세 화면이 아무것도
    // 못 집어 오고, 그 사실이 조용하다 — 화면에 필드가 없는 것이 정상이기 때문이다.
    const screenParam = isObject(argument) ? argument.screenParam : undefined;
    if (typeof screenParam === "string" && !screenParams.has(screenParam)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 화면 인자 '${screenParam}'를 가리키는데 화면의 params에 없습니다.`
      });
    }
    // 목록을 조회하는 시점에는 아직 항목이 없다. 자기가 받아 올 행을 가리켜
    // 조회할 수는 없으므로 itemField는 여기서 뜻이 없다.
    //
    // **되풀이되는 묶음 안은 다르다.** 그 요소는 항목마다 한 번씩 그려지므로 그릴
    // 때 이미 항목이 정해져 있다 — 보완 품목마다 채울 칸이 다른 것이 그 자리다.
    if (isObject(argument) && typeof argument.itemField === "string" && !isObject(context.inList)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 조회 인자 '${paramName}'가 항목의 조각(itemField)을 가리킵니다. 조회하는 시점에는 아직 항목이 없습니다 — 항목의 조각은 눌렸을 때의 동작(action.params)에서만 쓸 수 있습니다.`
      });
    }
  }
}
