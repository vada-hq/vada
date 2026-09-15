import {
  children,
  directChildNamed,
  findDescendant,
  textOf,
  toSource
} from "./screen-draft-node.mjs";
import {
  CONTROL_KINDS,
  CONTROL_NAMES,
  DISABLED_CONTROL_FILL,
  SEARCHABLE_WRAPPER_NAME,
  isButton
} from "./screen-draft-signals.mjs";

function parseLabel(raw) {
  const label = raw.trim();
  const required = label.endsWith("*");
  return {
    label: required ? label.slice(0, -1).trimEnd() : label,
    required
  };
}

export function isFieldWrapper(node) {
  return directChildNamed(node, "Label") !== null;
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
  input: ["type", "fieldKey", "label", "labelHidden", "placeholder", "helperText", "initialValue", "inputType", "multiline", "valueType", "required", "readOnly", "validation"],
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

export function describeField(wrapper, questions, index, lookup) {
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
    // 칸 이름이 무엇을 받는지 말하면 그것을 쓴다. 아무 이름도 못 찾으면 그때만 묻는다.
    const kind = CONTROL_KINDS[control?.name ?? ""];
    if (!confirmed && kind === undefined) {
      questions.push(`${at} inputType·valueType — 디자인에 없습니다(기본 text/string).`);
    }
    return {
      source: toSource(wrapper),
      spec: withPrecedent(
        {
          type: "input",
          label,
          // 켜고 끄는 칸에는 안내 문구가 없다 — 그려진 글은 곁의 라벨이다.
          placeholder: kind?.valueType === "boolean" ? null : controlText || null,
          required,
          ...(kind ?? {})
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

// 라벨 없이 홀로 선 컨트롤을 필드로 뽑는다.
//
// 등록 노드는 컨트롤 자신이다 — 라벨도 보조 텍스트도 없으니 그것이 모든 부분을
// 담는 가장 안쪽 노드다(등록 노드 계약).
//
// 라벨은 그려진 문구에서 짐작한다. 짐작이므로 반드시 질문으로 알린다 — 명세의
// label은 검증기가 등록 노드 하위에서 정확 일치로 찾으므로 문구를 그대로 둬야
// 통과하지만, 그것이 사람이 부를 이름인지는 다른 문제다.
export function describeBareControl(node, questions, lookup) {
  const drawn = textOf(node);
  const isSelect = node.name === "Dropdown";

  if (drawn === "") {
    // 선택지도 문구도 없는 빈 프레임이다(EVT-00A 20:4166, MY-01도 같은 자리).
    // 조용히 빠뜨리면 명세에 구멍이 나고도 아무도 모른다.
    questions.push(
      `${node.id}(${node.name}) — 문구도 선택지도 그려져 있지 않습니다. 명세에 넣을지, 넣는다면 라벨과 선택지 출처를 알려주세요.`
    );
    return null;
  }

  const { confirmed, candidates } = lookup(drawn);
  questions.push(
    `${node.id} 라벨 — 라벨 노드가 없어 그려진 문구 '${drawn}'을 라벨로 뒀습니다. 이것이 placeholder라면 라벨을 따로 정하세요.${describeCandidates(candidates)}`
  );
  if (!confirmed) {
    questions.push(
      `${node.id} fieldKey — '${drawn}'에 쓸 영문 키를 정하세요.`
    );
  }

  return {
    source: toSource(node),
    spec: withPrecedent(
      isSelect
        ? {
            type: "select",
            label: drawn,
            placeholder: null,
            required: false,
            initiallyDisabled: false,
            searchable: false,
            presentation: "dropdown"
          }
        : {
            type: "input",
            label: drawn,
            placeholder: null,
            required: false,
            // 홀로 선 칸도 이름이 무엇을 받는지 말한다.
            ...(CONTROL_KINDS[node.name] ?? {})
          },
      confirmed
    )
  };
}
