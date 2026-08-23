// figma.design.json에서 화면 동작 명세의 초안을 뽑는다.
//
// 목적은 완성된 screen.json이 아니라 "기계가 확정할 수 있는 것"과
// "사람만 아는 것"을 갈라 놓는 것이다. 후자는 questions로 보고한다.
//
// 등록 노드는 element-types.md의 계약을 따른다: 요소의 모든 부분(라벨·컨트롤·
// 보조 텍스트)을 포함하는 가장 안쪽 노드.

import { findPrecedent } from "./spec-precedent.mjs";

const BUTTON_NAME_PATTERN = /^(Btn|Button)\b/u;
const SEARCHABLE_WRAPPER_NAME = "ProfileSearchSelect";
const CONTROL_NAMES = new Set(["Text Input", "Dropdown"]);
const DISABLED_CONTROL_FILL = "#F9FAFB";
const ACTIVE_CONTROL_FILL = "#FFFFFF";

function children(node) {
  return Array.isArray(node?.children) ? node.children : [];
}

function directChildNamed(node, name) {
  return children(node).find((child) => child.name === name) ?? null;
}

function collectText(node, parts = []) {
  if (typeof node?.text?.content === "string") {
    parts.push(node.text.content);
  }
  for (const child of children(node)) {
    collectText(child, parts);
  }
  return parts;
}

function textOf(node) {
  return collectText(node).join("").trim();
}

function findDescendant(node, predicate) {
  for (const child of children(node)) {
    if (predicate(child)) {
      return child;
    }
    const found = findDescendant(child, predicate);
    if (found) {
      return found;
    }
  }
  return null;
}

function parseLabel(raw) {
  const label = raw.trim();
  const required = label.endsWith("*");
  return {
    label: required ? label.slice(0, -1).trimEnd() : label,
    required
  };
}

function isFieldWrapper(node) {
  return directChildNamed(node, "Label") !== null;
}

function isButton(node) {
  return BUTTON_NAME_PATTERN.test(node?.name ?? "");
}

function toSource(node) {
  return { nodeId: node.id, name: node.name, figmaType: "FRAME" };
}

// 선택지를 모두 펼친 버튼 묶음인가(select.presentation: choiceGroup).
function findChoiceButtons(wrapper) {
  const container = children(wrapper).find(
    (child) => children(child).filter(isButton).length >= 2
  );
  return container ? children(container).filter(isButton) : [];
}

// 다른 스코프의 같은 라벨은 답이 아니라 실마리다. 질문에 덧붙여 보여준다.
function describeCandidates(candidates) {
  if (candidates.length === 0) {
    return "";
  }
  return ` (선례: ${candidates
    .map((entry) => `${entry.screenIds.join("·")}의 '${entry.stateScopeKey}'에서는 ${entry.fieldKey}`)
    .join(", ")})`;
}

// 스키마 선언 순서대로 다시 쌓는다. 검증기가 순서를 강제하므로 초안도 맞춘다.
const DRAFT_KEY_ORDER = {
  input: ["type", "fieldKey", "label", "placeholder", "helperText", "initialValue", "inputType", "valueType", "required", "validation"],
  select: ["type", "fieldKey", "label", "placeholder", "disabledPlaceholder", "helperText", "presentation", "initialValue", "valueType", "required", "initiallyDisabled", "searchable", "optionsSource", "enabledWhen", "resetOnChangeOf"]
};

// 확정된 선례를 초안에 얹는다. 데이터 계약만 물려받고 문구·활성 여부는
// 화면 고유라 디자인에서 유도한 값을 그대로 둔다.
function withPrecedent(spec, confirmed) {
  if (!confirmed) {
    return spec;
  }
  const merged = { ...spec, fieldKey: confirmed.fieldKey, ...confirmed.contract };
  const ordered = {};
  for (const key of DRAFT_KEY_ORDER[spec.type] ?? Object.keys(merged)) {
    if (merged[key] !== undefined) {
      ordered[key] = merged[key];
    }
  }
  return ordered;
}

function describeField(wrapper, questions, index, lookup) {
  const labelNode = directChildNamed(wrapper, "Label");
  const { label, required } = parseLabel(textOf(labelNode));
  const at = `elements[${index}](${label})`;
  const { confirmed, candidates } = lookup(label);

  const choiceButtons = findChoiceButtons(wrapper);
  const control = findDescendant(wrapper, (node) => CONTROL_NAMES.has(node.name));
  const controlFill = control?.appearance?.fills?.[0]?.color;
  const initiallyDisabled = controlFill === DISABLED_CONTROL_FILL;
  const controlText = control ? textOf(control) : "";

  // fieldKey는 디자인에 없다 — 라벨의 번역·명명 규칙이므로 사람이 정한다.
  // 다만 같은 스코프의 다른 화면에 같은 라벨이 있으면 그 선례가 답이다.
  if (!confirmed) {
    questions.push(
      `${at} fieldKey — 라벨 '${label}'에 쓸 영문 키를 정하세요.${describeCandidates(candidates)}`
    );
  }

  if (choiceButtons.length > 0) {
    if (!confirmed) {
      questions.push(
        `${at} optionsSource.key — 펼친 선택지 ${choiceButtons.length}개: ${choiceButtons
          .map((button) => textOf(button))
          .join(", ")}. 카탈로그 key를 정하거나 새로 만드세요.`
      );
    }
    return {
      source: toSource(wrapper),
      spec: withPrecedent(
        {
          type: "select",
          label,
          required,
          initiallyDisabled,
          searchable: false,
          presentation: "choiceGroup"
        },
        confirmed
      )
    };
  }

  const isSelect =
    wrapper.name === SEARCHABLE_WRAPPER_NAME ||
    control?.name === "Dropdown" ||
    findDescendant(wrapper, (node) => node.name === "Dropdown") !== null;

  if (!isSelect) {
    if (!confirmed) {
      questions.push(`${at} inputType·valueType — 디자인에 없습니다(기본 text/string).`);
    }
    return {
      source: toSource(wrapper),
      spec: withPrecedent(
        {
          type: "input",
          label,
          placeholder: controlText || null,
          required
        },
        confirmed
      )
    };
  }

  // 드롭다운은 선택지가 디자인에 없다(자식 없는 빈 프레임인 경우가 많다).
  if (!confirmed) {
    questions.push(
      `${at} optionsSource.key — 드롭다운 선택지는 디자인에 없습니다. 정적 목록인지 원격인지와 카탈로그 key를 알려주세요.`
    );
  }
  // 문구는 선례로 답할 수 없다 — 같은 필드라도 화면마다 다르게 쓴다
  // (ONB-01 '단과대학을 선택하세요' 대 INV-01 '단과대학을 검색하세요').
  if (initiallyDisabled) {
    questions.push(
      `${at} placeholder — 디자인은 비활성 상태만 그려서 '${controlText}'는 disabledPlaceholder입니다. 활성 상태 문구가 필요합니다.`
    );
  }

  return {
    source: toSource(wrapper),
    spec: withPrecedent(
      {
        type: "select",
        label,
        ...(initiallyDisabled
          ? { placeholder: null, disabledPlaceholder: controlText || null }
          : { placeholder: controlText || null }),
        required,
        initiallyDisabled,
        searchable: wrapper.name === SEARCHABLE_WRAPPER_NAME,
        presentation: "dropdown"
      },
      confirmed
    )
  };
}

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

function describeButton(node, questions, index, emphasis) {
  // 카드형 버튼은 설명문·배지까지 품는다. 라벨은 첫 텍스트다.
  const [label, ...rest] = collectText(node)
    .map((part) => part.trim())
    .filter(Boolean);
  const at = `elements[${index}](${label})`;
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

function countFieldWrappers(node) {
  let count = 0;
  for (const child of children(node)) {
    if (isFieldWrapper(child)) {
      count += 1;
      continue; // 필드 내부는 세지 않는다
    }
    count += countFieldWrappers(child);
  }
  return count;
}

function containsButton(node) {
  for (const child of children(node)) {
    if (isFieldWrapper(child)) {
      continue; // choiceGroup의 선택지 버튼은 필드 내부라 세지 않는다
    }
    if (isButton(child) || containsButton(child)) {
      return true;
    }
  }
  return false;
}

// 묶음: 필드 래퍼를 2개 이상 품고, 첫 자식이 필드를 전혀 품지 않는 제목인 노드.
// - 첫 자식이 필드를 품으면 제목이 아니라 폼 컨테이너다.
// - 버튼을 품으면 필드 묶음이 아니라 화면 카드 전체다.
function readGroupTitle(node) {
  if (countFieldWrappers(node) < 2 || containsButton(node)) {
    return null;
  }
  const first = children(node)[0];
  if (!first || isFieldWrapper(first) || findDescendant(first, isFieldWrapper)) {
    return null;
  }
  const parts = collectText(first).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? { title: parts[0], description: parts[1] ?? null } : null;
}

/**
 * @param {object} design figma.design.json
 * @param {{precedents?: {entries: object[], conflicts: string[]}, stateScopeKey?: string}} options
 *   이미 등록된 화면에서 모은 선례. 같은 스코프의 같은 라벨만 확정에 쓴다.
 */
// 대시보드의 섹션: 자식이 정확히 둘이고 첫째가 제목(텍스트만), 둘째가
// 되풀이 묶음인 노드. 그 안의 항목은 화면 요소가 아니라 데이터의 되풀이다.
//
// 되풀이 판별은 형제의 이름이 같은가로 한다. 이름은 제품마다 다르지만
// '형제끼리 같다'는 관계는 제품과 무관하다.
//
// ONB-02의 시작 방식 카드도 닮은 형제 둘이지만 각각 별도 버튼이다. 갈리는
// 곳은 부모다 — 그쪽 부모는 화면 카드 전체라 자식이 여섯이다.
function isRepeatedGroup(node) {
  const items = children(node);
  if (items.length < 2) {
    return false;
  }
  const first = items[0]?.name ?? "";
  return (
    first !== "" &&
    items.every((item) => item.name === first) &&
    items.every((item) => textOf(item) !== "") &&
    // 필드는 데이터의 되풀이가 아니라 각각이 화면 요소다. 폼의 '제목 + 필드
    // 둘'(ONB-01 7:22)이 섹션으로 오인되면 필드를 통째로 삼킨다.
    countFieldWrappers(node) === 0
  );
}

function readSection(node) {
  const parts = children(node);
  if (parts.length !== 2) {
    return null;
  }
  const [header, body] = parts;
  if (!isRepeatedGroup(body) || isRepeatedGroup(header)) {
    return null;
  }
  const titles = collectText(header).map((part) => part.trim()).filter(Boolean);
  return titles.length > 0
    ? { title: titles[0], header, body, itemCount: children(body).length }
    : null;
}

export function draftScreenElements(design, options = {}) {
  const elements = [];
  const questions = [];
  const { precedents, stateScopeKey, excludeNodeNames } = options;
  // 셸(사이드바·헤더)은 화면의 요소가 아니라 모든 화면이 공유하는 구조다.
  // 어느 노드가 셸인지는 wireframe이 아는 것이라 파이프라인이 이름을 갖지 않고
  // 호출자가 넘긴다(specs/<wireframe>/shell.json의 design.excludeNodeNames).
  const excluded = new Set(excludeNodeNames ?? []);
  const lookup = (label) =>
    precedents ? findPrecedent(precedents, { label, stateScopeKey }) : { confirmed: null, candidates: [] };

  for (const conflict of precedents?.conflicts ?? []) {
    questions.push(`선례가 서로 어긋납니다 — ${conflict} 어느 쪽이 맞는지 정하세요.`);
  }

  const visit = (node, insideGroup) => {
    for (const child of children(node)) {
      if (excluded.has(child?.name)) {
        continue;
      }

      if (isFieldWrapper(child)) {
        elements.push(describeField(child, questions, elements.length, lookup));
        continue; // 필드 내부는 더 파지 않는다(등록 노드 계약)
      }

      const section = readSection(child);
      if (section) {
        const at = `elements[${elements.length}](${section.title})`;
        elements.push({
          source: toSource(child),
          // 항목 수가 명세에 고정인지 데이터에 달렸는지는 디자인이 말해 주지
          // 않는다. 되풀이가 보이므로 itemList를 기본으로 두고 질문한다.
          spec: { type: "itemList", title: section.title }
        });
        questions.push(
          `${at} 유형 — 항목 ${section.itemCount}개가 되풀이됩니다. 항목 수가 명세에 고정이면 summary, 데이터에 달렸으면 itemList입니다. itemList면 dataSourceKey도 정하세요.`
        );
        // 본문은 데이터의 되풀이라 파지 않는다. 헤더는 링크 버튼을 품을 수
        // 있으므로 계속 훑는다.
        visit(section.header, insideGroup);
        continue;
      }
      const siblingButtons = findSiblingButtonGroup(child);
      if (siblingButtons) {
        // 보수적으로 각각 별도 버튼으로 뽑는다 — 합치는 것이 나누는 것보다 쉽다.
        questions.push(
          `${child.id} — 텍스트를 가진 버튼 ${siblingButtons.length}개가 나란히 있습니다(${siblingButtons
            .map((button) => collectText(button)[0]?.trim())
            .join(", ")}). 읽는 방법이 셋입니다: 각각 별도 버튼(ONB-02의 시작 방식 카드), 하나를 고르는 선택지(select.presentation: choiceGroup), 값 묶음이나 되풀이 목록(summary·itemList — HOME-01K의 통계 타일). 어느 쪽입니까?`
        );
      }
      if (isButton(child)) {
        // 스키마상 button.label은 필수다. 텍스트 없는 버튼(항목 메뉴의 … 등)은
        // 화면 수준 요소가 아니라 다른 요소의 내부 조작이다.
        if (textOf(child) === "") {
          questions.push(
            `${child.id}(${child.name}) — 텍스트 없는 조작입니다. 어떤 요소의 내부 조작인지 알려주세요.`
          );
          continue;
        }
        elements.push(
          describeButton(child, questions, elements.length, getButtonEmphasis(child))
        );
        continue;
      }

      const group = insideGroup ? null : readGroupTitle(child);
      if (group) {
        const at = `elements[${elements.length}](${group.title})`;
        const marker = elements.length;
        elements.push({
          source: toSource(child),
          spec: { type: "group", title: group.title, description: group.description }
        });
        visit(child, true);
        // 묶음 뒤에 등록된 필드가 멤버다.
        const members = elements
          .slice(marker + 1)
          .filter((element) => element.spec.type === "input" || element.spec.type === "select");
        elements[marker].spec.memberFieldKeys = members.map(
          (member) => member.spec.fieldKey ?? member.spec.label
        );
        if (members.some((member) => member.spec.fieldKey === undefined)) {
          questions.push(
            `${at} memberFieldKeys — fieldKey가 없는 멤버는 라벨로 채워 뒀습니다. 키가 정해지면 바꾸세요.`
          );
        }
        continue;
      }

      visit(child, insideGroup);
    }
  };

  visit(design.root, false);

  // note는 "다른 화면의 값을 보여준다"는 의미라 디자인에서 유도할 수 없다.
  questions.push(
    "note 요소 — 완성된 문자열만 그려져 있어 파생 여부를 판정할 수 없습니다. 다른 스코프의 값을 잇는 안내가 있으면 알려주세요."
  );

  return { elements, questions };
}

// 이미 등록된 화면과 대조해 추출 정확도를 측정한다.
// 인덱스가 아니라 nodeId로 짝지어야 한 요소가 밀려도 나머지가 왜곡되지 않는다.
export function compareWithSpec(draftElements, specElements) {
  const identity = (element) =>
    element?.spec?.type === "group" ? element.spec.title : element?.spec?.label;
  const describe = (element) =>
    element ? `${element.source.nodeId} ${element.spec.type} ${identity(element) ?? ""}`.trim() : "—";

  const draftByNode = new Map(draftElements.map((element) => [element.source.nodeId, element]));
  const rows = specElements.map((actual) => {
    const draft = draftByNode.get(actual.source.nodeId) ?? null;
    return {
      nodeId: actual.source.nodeId,
      matched: draft !== null,
      typeMatch: draft?.spec?.type === actual.spec.type,
      labelMatch: identity(draft) === identity(actual),
      draft: describe(draft),
      actual: describe(actual)
    };
  });

  const specNodeIds = new Set(specElements.map((element) => element.source.nodeId));
  for (const draft of draftElements) {
    if (!specNodeIds.has(draft.source.nodeId)) {
      rows.push({
        nodeId: draft.source.nodeId,
        matched: false,
        typeMatch: false,
        labelMatch: false,
        draft: describe(draft),
        actual: "— (등록되지 않은 요소를 뽑음)"
      });
    }
  }
  return rows;
}

export const DRAFT_SIGNALS = {
  BUTTON_NAME_PATTERN,
  SEARCHABLE_WRAPPER_NAME,
  DISABLED_CONTROL_FILL,
  ACTIVE_CONTROL_FILL
};
