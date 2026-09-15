import {
  children,
  collectText,
  findDescendant,
  textOf,
  toSource
} from "./screen-draft-node.mjs";
import { isFieldWrapper } from "./screen-draft-fields.mjs";
import { isButton } from "./screen-draft-signals.mjs";

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
export function readGroupTitle(node) {
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
// 레이어 이름에서 **꼴**만 떼어 낸다.
//
// 이 wireframe은 되풀이되는 항목의 이름에 그 항목의 내용을 적는다
// (`Button - 행사장 안전 점검 상세 보기`). 그래서 이름을 통째로 견주면 칸반
// 카드 둘이 서로 다른 것이 되고, 그 위의 열이 되풀이로 보이지 않아 **열 넷이
// 통째로 사라졌다**(EVT-TASK-01).
//
// 되풀이는 이름이 같아서가 아니라 **같은 꼴이라서** 되풀이다. 저장소 전체에서
// ` - `를 쓰는 이름은 스물하나뿐이고 앞부분은 전부 추출기가 이미 아는 유형
// 이름이다(Button 18 · Dropdown 2 · Text Input 1) — 관례가 흔들리지 않는다.
function nameKind(name) {
  return (name ?? "").split(" - ")[0];
}

function isRepeatedGroup(node) {
  const items = children(node);
  if (items.length < 2) {
    return false;
  }
  const first = nameKind(items[0]?.name);
  return (
    first !== "" &&
    items.every((item) => nameKind(item.name) === first) &&
    items.every((item) => textOf(item) !== "") &&
    // 필드는 데이터의 되풀이가 아니라 각각이 화면 요소다. 폼의 '제목 + 필드
    // 둘'(ONB-01 7:22)이 섹션으로 오인되면 필드를 통째로 삼킨다.
    countFieldWrappers(node) === 0
  );
}

// 제목 없이 맨몸으로 선 되풀이 묶음인가.
//
// `readSection`은 '제목 + 되풀이' 두 자식을 요구한다. 목록 화면의 카드 목록은
// 제목이 없어 그 틀에 걸리지 않았다(EVT-00A 20:4167). 되풀이 자체는 이미
// `isRepeatedGroup`이 가릴 수 있으므로, 제목을 요구하지 않는 길을 하나 더 낸다.
//
// 버튼만 든 묶음은 제외한다 — 그쪽은 '각각 버튼인지 하나 고르기인지'가 쟁점이라
// 이미 findSiblingButtonGroup이 다르게 묻는다(ONB-02의 시작 방식 카드).
function isBareList(node) {
  if (!isRepeatedGroup(node)) {
    return false;
  }
  // 겉이 버튼이어도 목록일 수 있다.
  //
  // 예전에는 '버튼만 든 묶음'을 통째로 제외했다. 나란한 버튼은 '각각 버튼인지
  // 하나 고르기인지'가 쟁점이고 findSiblingButtonGroup이 그것을 다르게 묻기
  // 때문이었다. 그런데 **눌리는 카드 목록이면 되풀이의 겉이 버튼인 것이
  // 자연스럽다** — EVT-MEET-01의 회의 카드 셋(25:2012·25:2041·25:2070)이 그래서
  // 목록 대신 버튼 셋으로 나왔다.
  //
  // 제외하지 않아도 아래의 깊이 규칙이 둘을 가른다. 갈피·필터·시작 방식 카드는
  // 항목 안에 또 되풀이가 없고, 회의 카드는 있다(날짜·장소·참가 줄).
  // 안에 섹션(제목 + 되풀이)이 있으면 바깥은 목록이 아니라 배치다. 삼키면 섹션이
  // 통째로 보이지 않는다.
  //
  // 여기서 한 가지를 포기했다. OPS-MEET-01A의 행사별 묶음(18:437)은 '섹션들의
  // 목록'이라 이 규칙에 걸려 통째로는 안 잡히고 묶음 하나하나가 섹션으로 잡힌다.
  // 그런데 HOME-01K의 대시보드 열(16:134)도 **구조가 똑같다** — 섹션 둘을 담은
  // Container다. 구조로는 갈 수 없어 둘 다 안쪽을 잡는 쪽을 골랐다. 묶음이
  // 하나로 묶이는지는 사람이 답할 것이고, 섹션을 통째로 잃는 것이 더 나쁘다.
  if (findDescendant(node, (inner) => readSection(inner) !== null)) {
    return false;
  }
  // **되풀이의 깊이가 목록을 가른다.** 카드 안의 '아이콘+글' 줄이나 라벨-값 쌍도
  // 형제 이름이 같아 되풀이로 보이지만, 그것들은 항목이 아니라 항목의 부분이다.
  // 진짜 목록의 항목은 저마다 안에 또 되풀이를 품는다(카드 안의 날짜·장소·담당 줄).
  //
  // OPS-MEET-01A에서 카드 하나하나가 itemList로 뽑힌 것이 이 구분이 없어서였다.
  return children(node).every(
    (item) => findDescendant(item, isRepeatedGroup) !== null
  );
}

// 항목이 저마다 글을 둘 이상 갖는 되풀이인가.
//
// 되풀이는 맞는데 항목이 글 하나뿐이면 그것은 목록이 아니라 **한 줄**이다. 카드
// 안의 '아이콘+날짜 / 아이콘+장소 / 아이콘+담당' 줄이 그렇고(OPS-MEET-01A에서
// 회의 카드 하나하나가 섹션으로 읽힌 원인), 칸반 열의 머리 줄('예정' + 건수)도
// 그렇다.
function isItemRepeat(node) {
  return (
    isRepeatedGroup(node) &&
    !children(node).every((item) => collectText(item).length < 2)
  );
}

function readSection(node) {
  const parts = children(node);
  if (parts.length !== 2) {
    return null;
  }
  const [header, body] = parts;
  // 머리에도 본문과 같은 잣대를 쓴다. 예전에는 머리가 '되풀이처럼 보이기만 해도'
  // 물러났는데, 칸반 열의 머리는 이름이 같은 Text 둘('예정'과 건수)이라 그렇게
  // 보인다. 그래서 **열 넷이 통째로 섹션이 되지 못했다**(EVT-TASK-01·TASK-01).
  if (isItemRepeat(header)) {
    return null;
  }
  // 항목이 하나뿐인 열은 되풀이로 보이지 않는다 — Figma가 감싸개를 접어 카드가
  // 곧장 본문이 된다(TASK-01 18:259, EVT-TASK-01 25:1505·25:1536).
  // 그때는 **이름이 말한다**: 이름에 그 항목의 내용이 적혀 있으면 인스턴스이고,
  // 인스턴스가 하나뿐인 목록도 목록이다. 저장소의 `X - 내용` 이름 스물하나가
  // 전부 그런 항목이라 흔들리지 않는다 — 섹션 머리 옆의 조작은 그냥 `Btn`이다
  // (EVT-MEET-01의 '전체 회의 보기').
  const single = !isItemRepeat(body) && nameKind(body?.name) !== (body?.name ?? "");
  if (!isItemRepeat(body) && !single) {
    return null;
  }
  // 본문의 항목이 저마다 섹션이면 바깥은 목록이 아니라 **배치**다.
  //
  // `isBareList`는 이미 이 가드를 갖고 있었는데 여기에는 없었다. 그래서 칸반
  // 보드 전체(EVT-TASK-01 25:1385 = '행사 업무' 제목 + 열 넷)가 목록 하나로
  // 읽혀 열 넷이 통째로 사라졌다. 안쪽을 잡는 쪽을 고르는 것은 `isBareList`가
  // 내린 것과 같은 판단이다 — 섹션을 통째로 잃는 것이 더 나쁘다.
  if (
    !single &&
    children(body).some(
      (item) => readSection(item) !== null || findDescendant(item, (inner) => readSection(inner) !== null)
    )
  ) {
    return null;
  }
  const titles = collectText(header).map((part) => part.trim()).filter(Boolean);
  return titles.length > 0
    ? { title: titles[0], header, body, itemCount: single ? 1 : children(body).length }
    : null;
}


export function describeBareList(node, questions, index) {
  if (!isBareList(node)) {
    return null;
  }
  const at = `elements[${index}]`;
  questions.push(
    `${node.id} — 이름이 같은 형제 ${children(node).length}개가 제목 없이 되풀이됩니다. 읽는 방법이 셋입니다: 개수를 데이터가 정하면 itemList 하나(${at}, dataSourceKey도 정하세요), 개수가 명세에 고정이면 형제 각각을 따로 등록(TASK-01의 칸반 열), 값 묶음이면 summary. 어느 쪽입니까?`
  );
  return {
    source: toSource(node),
    spec: { type: "itemList" }
  };
}

export function describeSection(node, questions, index) {
  const section = readSection(node);
  if (!section) {
    return null;
  }
  const at = `elements[${index}](${section.title})`;
  questions.push(
    `${at} 유형 — 항목 ${section.itemCount}개가 되풀이됩니다. 항목 수가 명세에 고정이면 summary, 데이터에 달렸으면 itemList입니다. itemList면 dataSourceKey도 정하세요.`
  );
  return {
    element: {
      source: toSource(node),
      spec: { type: "itemList", title: section.title }
    },
    section
  };
}
