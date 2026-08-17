// figma.design.json에서 화면 동작 명세의 초안을 뽑는다.
//
// 목적은 완성된 screen.json이 아니라 "기계가 확정할 수 있는 것"과
// "사람만 아는 것"을 갈라 놓는 것이다. 후자는 questions로 보고한다.
//
// 등록 노드는 element-types.md의 계약을 따른다: 요소의 모든 부분(라벨·컨트롤·
// 보조 텍스트)을 포함하는 가장 안쪽 노드.

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

function describeField(wrapper, questions, index) {
  const labelNode = directChildNamed(wrapper, "Label");
  const { label, required } = parseLabel(textOf(labelNode));
  const at = `elements[${index}](${label})`;

  const choiceButtons = findChoiceButtons(wrapper);
  const control = findDescendant(wrapper, (node) => CONTROL_NAMES.has(node.name));
  const controlFill = control?.appearance?.fills?.[0]?.color;
  const initiallyDisabled = controlFill === DISABLED_CONTROL_FILL;
  const controlText = control ? textOf(control) : "";

  // fieldKey는 디자인에 없다 — 라벨의 번역·명명 규칙이므로 사람이 정한다.
  questions.push(`${at} fieldKey — 라벨 '${label}'에 쓸 영문 키를 정하세요.`);

  if (choiceButtons.length > 0) {
    questions.push(
      `${at} optionsSource.key — 펼친 선택지 ${choiceButtons.length}개: ${choiceButtons
        .map((button) => textOf(button))
        .join(", ")}. 카탈로그 key를 정하거나 새로 만드세요.`
    );
    return {
      source: toSource(wrapper),
      spec: {
        type: "select",
        label,
        required,
        initiallyDisabled,
        searchable: false,
        presentation: "choiceGroup"
      }
    };
  }

  const isSelect =
    wrapper.name === SEARCHABLE_WRAPPER_NAME ||
    control?.name === "Dropdown" ||
    findDescendant(wrapper, (node) => node.name === "Dropdown") !== null;

  if (!isSelect) {
    questions.push(`${at} inputType·valueType — 디자인에 없습니다(기본 text/string).`);
    return {
      source: toSource(wrapper),
      spec: {
        type: "input",
        label,
        placeholder: controlText || null,
        required
      }
    };
  }

  // 드롭다운은 선택지가 디자인에 없다(자식 없는 빈 프레임인 경우가 많다).
  questions.push(
    `${at} optionsSource.key — 드롭다운 선택지는 디자인에 없습니다. 정적 목록인지 원격인지와 카탈로그 key를 알려주세요.`
  );
  if (initiallyDisabled) {
    questions.push(
      `${at} placeholder — 디자인은 비활성 상태만 그려서 '${controlText}'는 disabledPlaceholder입니다. 활성 상태 문구가 필요합니다.`
    );
  }

  return {
    source: toSource(wrapper),
    spec: {
      type: "select",
      label,
      ...(initiallyDisabled
        ? { placeholder: null, disabledPlaceholder: controlText || null }
        : { placeholder: controlText || null }),
      required,
      initiallyDisabled,
      searchable: wrapper.name === SEARCHABLE_WRAPPER_NAME,
      presentation: "dropdown"
    }
  };
}

function describeButton(node, questions, index) {
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
  return { source: toSource(node), spec: { type: "button", label: label ?? "" } };
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

export function draftScreenElements(design) {
  const elements = [];
  const questions = [];

  const visit = (node, insideGroup) => {
    for (const child of children(node)) {
      if (isFieldWrapper(child)) {
        elements.push(describeField(child, questions, elements.length));
        continue; // 필드 내부는 더 파지 않는다(등록 노드 계약)
      }
      if (isButton(child)) {
        elements.push(describeButton(child, questions, elements.length));
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
        elements[marker].spec.memberFieldKeys = members.map((member) => member.spec.label);
        questions.push(
          `${at} memberFieldKeys — 지금은 라벨로 채워 뒀습니다. 멤버 필드의 fieldKey가 정해지면 바꾸세요.`
        );
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
