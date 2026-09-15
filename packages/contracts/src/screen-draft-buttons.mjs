import {
  children,
  collectText,
  findDescendant,
  textOf,
  toSource
} from "./screen-draft-node.mjs";
import { isButton } from "./screen-draft-signals.mjs";

/**
 * 세는 말의 모양. `tests/spec-counted-copy.test.mjs`가 계약에서 막는 그 규칙과 같다 —
 * 두 벌을 두면 한쪽만 넓어진다.
 */
const COUNTED = /\d[\d,]*\s*(건|개|명|원|장|회|번|%|시간|분)/;

// 버튼 강조도는 형태에서 유도한다: 채워진 것 > 테두리만 있는 것 > 아무것도
// 없는 것. 이건 일반 시각 관례라 파이프라인이 알아도 된다. 반면 "#155DFC가
// 주 버튼"은 이 제품의 디자인 시스템이라 알면 안 된다 — 색은 보지 않는다.
function getButtonEmphasis(node) {
  const appearance = node?.appearance ?? {};
  const hasFill = Array.isArray(appearance.fills) && appearance.fills.length > 0;
  const hasStroke =
    Array.isArray(appearance.strokes) && appearance.strokes.length > 0;

  // 테두리를 두른 버튼은 외곽선형(보조)이다. 색을 보지 않아도 갈린다 —
  // 꽉 찬 버튼은 테두리가 필요 없고, 외곽선형은 테두리가 형태 그 자체다.
  if (hasStroke) {
    return "secondary";
  }
  return hasFill ? "primary" : "quiet";
}

export function describeButton(node, questions, index) {
  // 카드형 버튼은 설명문·배지까지 품는다. 라벨은 첫 텍스트다.
  const [label, ...rest] = collectText(node)
    .map((part) => part.trim())
    .filter(Boolean);
  const at = `elements[${index}](${label})`;
  const emphasis = getButtonEmphasis(node);
  const said = collectText(node).join(" ");
  if (COUNTED.test(said)) {
    questions.push(
      `${node.id}(${said.trim().slice(0, 40)}) — 세는 수가 든 단추입니다. 그 수가 데이터에서 오면 button으로 두면 **고정 글로 굳습니다**(button의 어휘에는 데이터를 담을 자리가 없습니다). 데이터라면 summary + action으로 등록하세요. 그림에 박힌 예시 수일 뿐이면 그대로 두어도 됩니다.`
    );
  }
  questions.push(`${at} action.targetScreenId — 이동 대상 화면은 디자인에 없습니다.`);
  if (rest.length > 0) {
    questions.push(
      `${at} description·badge — 라벨 외 텍스트 ${rest.length}건: ${rest.join(" / ")}. 어느 것이 설명이고 배지인지 알려주세요.`
    );
  }
  return {
    source: toSource(node),
    spec: {
      type: "button",
      label: label ?? "",
      ...(emphasis ? { emphasis } : {})
    }
  };
}

// 텍스트를 가진 Button 형제 묶음. 세 가지로 읽힐 수 있다:
//   - 각각 별도 버튼(ONB-02의 시작 방식 카드 — 각자 다른 화면으로 이동)
//   - 하나를 고르는 선택지(ORG-02의 조직 구성 방식 라디오 카드)
//   - 값 묶음·되풀이 목록(HOME-01K의 통계 타일 — 누르는 것이 아니라 읽는 것)
// 섹션(제목 + 되풀이 묶음) 안에 있으면 셋째로 확정되지만, 여기까지 온 것은
// 섹션 밖이라 구조로는 갈리지 않는다.
// 이 wireframe에서는 선택 상태만 파란 계열로 그려 구분되지만, 그건 이 제품의
// 디자인 시스템 색이라 파이프라인이 알 수 없다. 추측하지 않고 질문한다.
function findSiblingButtonGroup(node) {
  const buttons = children(node).filter(isButton);
  return buttons.length >= 2 &&
    buttons.length === children(node).length &&
    buttons.every((button) => textOf(button) !== "")
    ? buttons
    : null;
}

// 하나를 고르는 묶음인가(select.presentation: choiceGroup).
//
// 나란한 버튼은 셋 중 하나다: 각각 별도 버튼(ONB-02의 시작 방식 카드), 하나
// 고르기(EVT-DOC-01의 문서 상태 필터), 되풀이 목록. 지금까지는 셋 다 질문으로
// 넘겼는데, **고른 것은 색으로 드러난다** — 골라진 하나만 배경이 다르다.
//
// **조건을 '하나만'으로 적는 것이 전부다.** 행동 짝도 하나만 채워져 있는 것처럼
// 보인다(ORG-02의 `이전`/`조직 만들기`, INV-01의 `참여하기`/`참여하지 않기` —
// 주 버튼이 blue-600이고 나머지가 흰색이다). 그런데 **둘일 때는 '하나만 다르다'가
// 성립하지 않는다** — 둘은 서로 다르거나 서로 같거나이지, 하나만 튀는 상태가
// 없다. 개수 조건을 따로 두지 않는 이유이고, 행동 짝이 걸리지 않는 이유다.
//
// 재 보니 이 wireframe의 나란한 버튼 묶음 스물아홉 중 이 규칙에 걸리는 것은
// 셋이고 전부 실제로 choiceGroup이다(오검출 0).
//
// 못 잡는 것도 적어 둔다. 밑줄로 고른 것을 표시하는 갈피 줄(MY-01 16:422,
// EVT-TASK-02 25:1743)은 배경이 전부 같아 걸리지 않는다. 둘짜리 고르기
// (EVT-TASK-01의 `전체 업무`/`내 업무`, ORG-02의 조직 구성 방식)도 위의 이유로
// 걸리지 않는다 — 여전히 질문으로 간다.
function findChosenButton(buttons) {
  // 표시하는 자리가 둘이다. 딱지형은 골라진 것의 **바탕**을 채우고(EVT-DOC-01의
  // 문서 상태 필터), 갈피형은 바탕을 그대로 두고 **글자 색**만 바꾼다(MY-01의
  // 업무 탭). 재 보니 이 wireframe에서 둘 중 하나로 걸리는 묶음은 전부 실제로
  // choiceGroup이다 — 어느 쪽이 쓰였는지는 화면이 정하므로 둘 다 본다.
  //
  // 두 자리를 한 지문으로 합치지 않는다. 합치면 '바탕도 글자도 각각은 안 맞는데
  // 합치니 맞는' 자리가 걸리고, 그것은 고른 표시가 아니다.
  const at =
    onlyDifferent(buttons.map(backgroundOf)) ?? onlyDifferent(buttons.map(inkOf));
  return at === null ? null : buttons[at];
}

// 나머지와 다른 것이 **정확히 하나**인 자리. 없으면 null.
//
// 나머지가 서로 같아야 한다는 것이 뒷조건이다 — 저마다 다른 색이면 고른 것이
// 아니라 값마다 색이 붙은 것이다(EVT-02의 강조 카드 셋은 red·yellow·blue다).
function onlyDifferent(marks) {
  const odd = marks.filter((mark, at) =>
    marks.every((other, otherAt) => otherAt === at || other !== mark)
  );
  if (odd.length !== 1) {
    return null;
  }
  const rest = marks.filter((mark) => mark !== odd[0]);
  return rest.every((mark) => mark === rest[0]) ? marks.indexOf(odd[0]) : null;
}

function backgroundOf(node) {
  return colorOf(node);
}

// 그 버튼에 처음 나오는 글의 색. 글자가 곧 라벨이라 첫 글이 그 버튼의 색이다.
function inkOf(node) {
  const text = findDescendant(node, (inner) => textOf(inner) !== "" && inner.text);
  return text ? colorOf(text) : "";
}

function colorOf(node) {
  return (node?.appearance?.fills ?? [])
    .filter((fill) => fill.type === "solid")
    .map((fill) => fill.color)
    .join(",");
}

// 작업 공간의 갈피 줄인가.
//
// 갈피 줄은 화면의 요소가 아니다 — 행사 화면 일곱이 똑같이 그리므로 shell.json의
// 작업 공간이 갖고, 화면은 어디에 그리는지(nodeId)만 적는다. 그런데 디자인만
// 보면 그냥 나란한 버튼 일곱이라, 화면마다 없는 요소 일곱과 질문 여덟이 났다.
//
// **셸이 이미 답을 갖고 있다.** 갈피의 문구가 `workspaces[].tabs[].label`에
// 적혀 있으므로, 나란한 버튼들의 문구가 그것과 그대로 맞으면 그 줄이다.
// 이름으로 거르지 않는 이유는 갈피 줄의 겉 이름이 그냥 `Container`이기 때문이고,
// 자리로 거르지 않는 이유는 화면마다 다르기 때문이다 — **문구만이 안 흔들린다.**
function matchesWorkspaceTabs(buttons, workspaces) {
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    return false;
  }
  const drawn = buttons.map((button) => (collectText(button)[0] ?? "").trim());
  return workspaces.some((workspace) => {
    const labels = (workspace?.tabs ?? []).map((tab) => tab?.label);
    return (
      labels.length === drawn.length &&
      labels.every((label, at) => label === drawn[at])
    );
  });
}


export function describeSiblingButtonGroup(node, questions, index, workspaces) {
  const buttons = findSiblingButtonGroup(node);
  if (!buttons) {
    return null;
  }

  const chosen = findChosenButton(buttons);
  const workspaceTabs = matchesWorkspaceTabs(buttons, workspaces);
  if (chosen && !workspaceTabs) {
    const at = `elements[${index}]`;
    questions.push(
      `${at}(${node.id}) — 버튼 ${buttons.length}개 중 '${collectText(chosen)[0]?.trim()}'만 배경이 달라 하나 고르기로 읽었습니다(${buttons
        .map((button) => collectText(button)[0]?.trim())
        .join(", ")}). fieldKey와 optionsSource.key를 정하세요 — initialValue는 그려진 문구라 선택지의 value로 바꿔야 합니다.`
    );
    return {
      element: {
        source: toSource(node),
        spec: {
          type: "select",
          placeholder: null,
          presentation: "choiceGroup",
          initialValue: collectText(chosen)[0]?.trim() ?? null,
          valueType: "string",
          required: true,
          initiallyDisabled: false,
          searchable: false,
          optionsSource: { key: "" }
        }
      },
      stop: true
    };
  }

  if (workspaceTabs) {
    return { element: null, stop: true };
  }

  questions.push(
    `${node.id} — 텍스트를 가진 버튼 ${buttons.length}개가 나란히 있습니다(${buttons
      .map((button) => collectText(button)[0]?.trim())
      .join(", ")}). 읽는 방법이 셋입니다: 각각 별도 버튼(ONB-02의 시작 방식 카드), 하나를 고르는 선택지(select.presentation: choiceGroup), 값 묶음이나 되풀이 목록(summary·itemList — HOME-01K의 통계 타일). 어느 쪽입니까?`
  );
  return { element: null, stop: false };
}
