import { allElementsOf } from "./element-walk.mjs";
import { DRAFT_SIGNALS } from "./screen-draft.mjs";
import { elementLabel, isObject } from "./spec-validation-values.mjs";

/** 이 그림 어딘가에 그 글이 그려져 있는가. 셸의 메뉴까지 함께 본다 — 제목이 어느
 * 자리에 그려지는지는 명세가 정하지 않기 때문이다. */
function designDrawsText(node, text) {
  if (!isObject(node)) {
    return false;
  }
  if (node.text?.content === text) {
    return true;
  }
  for (const child of node.children ?? []) {
    if (designDrawsText(child, text)) {
      return true;
    }
  }
  return false;
}

export function collectDesignNodeIds(root, ids = new Set()) {
  if (!isObject(root)) {
    return ids;
  }
  if (typeof root.id === "string") {
    ids.add(root.id);
  }
  if (Array.isArray(root.children)) {
    for (const child of root.children) {
      collectDesignNodeIds(child, ids);
    }
  }
  return ids;
}

function findDesignNode(root, nodeId) {
  if (!isObject(root)) {
    return null;
  }
  if (root.id === nodeId) {
    return root;
  }
  for (const child of Array.isArray(root.children) ? root.children : []) {
    const found = findDesignNode(child, nodeId);
    if (found) {
      return found;
    }
  }
  return null;
}

function collectSubtreeText(node, parts = []) {
  if (!isObject(node)) {
    return parts;
  }
  if (typeof node.text?.content === "string") {
    parts.push(node.text.content);
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectSubtreeText(child, parts);
  }
  return parts;
}

function normalizeForCompare(value) {
  // 라벨 끝의 필수 표시(*)는 required로 분리되어 spec.label에는 없다.
  return value.replace(/\s+/gu, "").replace(/\*$/u, "");
}

function collectSubtreeNodes(node, out = []) {
  if (!isObject(node)) {
    return out;
  }
  out.push(node);
  for (const child of Array.isArray(node.children) ? node.children : []) {
    collectSubtreeNodes(child, out);
  }
  return out;
}

// 하위 어딘가에 "합치면 정확히 이 텍스트가 되는" 노드가 있는지 본다.
// 부분 일치로 하면 placeholder가 라벨을 품기만 해도 통과한다
// (예: 라벨 '학교' ⊂ placeholder '학교명을 검색하세요').
function hasNodeWithExactText(root, expected) {
  const target = normalizeForCompare(expected);
  return collectSubtreeNodes(root).some(
    (node) => normalizeForCompare(collectSubtreeText(node).join("")) === target
  );
}

// 등록 노드 계약(element-types.md): nodeId는 요소의 모든 부분을 포함하는
// 가장 안쪽 노드다. 식별 텍스트가 하위 트리에 없으면 안쪽 컨트롤만 등록해
// 라벨·아이콘이 바깥에 남은 상태다.
function checkElementNodeCoverage(findings, context) {
  const { file, element, index, design } = context;
  const spec = element.spec;
  // label을 쓰는 유형(input·select·button)과 title을 쓰는 유형(group·summary·
  // itemList)이 섞여 있다. 새 유형이 생길 때마다 여기를 고치지 않도록 둘 다 본다.
  // 그려지지 않는 라벨은 디자인에서 찾을 수 없다. 글 없는 조작의 label은
  // '부르는 이름'이지 '그려지는 글'이 아니다.
  // 상황에 따라 바뀌는 글은 디자인이 한쪽만 그린다. 어느 쪽이든 그 자리에 있으면 된다.
  const candidates =
    spec.labelHidden === true
      ? []
      : [spec.label ?? spec.title, spec.labelWhenAnyItemIs?.label].filter(
          (text) => typeof text === "string" && text.trim()
        );
  const identifyingText = candidates[0];
  const nodeId = element.source?.nodeId;

  if (
    typeof identifyingText !== "string" ||
    !identifyingText.trim() ||
    typeof nodeId !== "string"
  ) {
    return;
  }

  const node = findDesignNode(design.root, nodeId);
  if (!node) {
    // nodeId 부재는 별도 검사가 이미 보고한다.
    return;
  }

  if (!candidates.some((text) => hasNodeWithExactText(node, text))) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 nodeId '${nodeId}'(${node.name})가 요소 전체를 대표하지 않습니다. 식별 텍스트 '${identifyingText}'가 이 노드 안에 없습니다. 라벨과 컨트롤을 모두 포함하는 노드로 등록하세요.`
    });
  }
}

// design에 있는데 명세에 없는 것을 본다.
//
// 지금까지 대조는 **한 방향**이었다 — 명세가 가리키는 자리를 화면이 그렸는가.
// 그래서 명세 자체의 구멍은 통과했다. TASK-01의 design `18:86`('업무 추가')이
// 명세에도 화면에도 없었는데 어떤 검사도 이를 잡지 못했고, EVT-00A 사이클에서
// 헤더에 자리를 내다가 우연히 드러났다.
//
// 보는 것은 **상호작용 노드**뿐이다(Btn·Button·Text Input·Dropdown). 이름이 곧
// 신호라 판정이 흔들리지 않고, 빠지면 화면의 동작이 통째로 사라진다. 되풀이나
// 카드처럼 읽는 방법이 여럿인 것은 여기서 세지 않는다 — 초안 추출기가 질문한다.
//
// 등록 요소의 하위 트리에 든 것은 그 요소의 내부다(목록 항목의 버튼, 선택지 묶음의
// 버튼). 문구 없는 노드도 세지 않는다 — 명세에 적을 라벨이 없다(선택지가 디자인에
// 비어 있는 드롭다운, 항목의 '…' 메뉴).
function checkDesignInteractionCoverage(findings, file, spec, design, shell) {
  // 변형은 **본 화면을 다르게 그린 것**이라 함께 있는 것은 본 화면이 이미 세었다.
  // 여기서 다시 세면 회의 목록의 검색·줄마다의 단추가 네 번 '명세에 없다'고 나온다.
  if (isObject(spec.variantOf)) {
    return;
  }
  // 모달은 **아래 화면 위에 뜬다.** 디자인이 그것을 화면 전체와 형제로 그리므로,
  // 이 화면이 그리는 부분 밖은 아래 화면의 것이다 - 거기까지 세면 아래 화면의
  // 버튼이 전부 '명세에 없는 상호작용'으로 보인다(ORG-07B의 머리 버튼 셋).
  const overlaySource = spec.overlay?.source;
  const root =
    typeof overlaySource === "string"
      ? (findDesignNode(design.root, overlaySource) ?? design.root)
      : design.root;
  const excluded = new Set(
    Array.isArray(shell?.design?.excludeNodeNames) ? shell.design.excludeNodeNames : []
  );
  const registered = new Set(
    allElementsOf(spec)
      .map(({ element }) => element?.source?.nodeId)
      .filter((nodeId) => typeof nodeId === "string")
  );
  // 한 자리를 여러 번 그린 그림. **나머지 사본도 등록된 것이다** — 하나만 세면
  // 나머지 안의 단추가 '명세에 없는 상호작용'으로 잡힌다.
  for (const { element } of allElementsOf(spec)) {
    for (const nodeId of element?.source?.alsoDrawnAt ?? []) {
      if (typeof nodeId === "string") {
        registered.add(nodeId);
      }
    }
  }
  // 작업 공간의 갈피 줄도 등록 노드다. 무엇을 그리는지는 셸이 알고 화면은 어디에
  // 그리는지만 아는데, 그 '어디'가 없으면 갈피 일곱이 명세에 없는 것으로 보인다.
  for (const nodeId of Object.values(spec.workspace?.source ?? {})) {
    if (typeof nodeId === "string") {
      registered.add(nodeId);
    }
  }
  // 현재 위치 경로도 등록 노드다. 그 안의 글은 명세가 갖고 있으므로 대조기가
  // 지켜야 한다 — 등록하지 않으면 디자인이 그린 여섯 조각이 아무의 것도 아니게 된다.
  if (typeof spec.breadcrumb?.source === "string") {
    registered.add(spec.breadcrumb.source);
  }
  // 목록의 쪽 줄도 그렇다. 디자인이 표와 쪽 줄을 형제로 두어 둘을 함께 품는 노드가
  // 없으므로, 목록이 그 자리를 따로 갖는다.
  for (const element of spec.elements) {
    const source = element?.spec?.paging?.source;
    if (typeof source === "string") {
      registered.add(source);
    }
  }
  // 되풀이되는 요소는 **첫 사본의 노드만** 등록한다(itemFields 계약). 그런데 디자인이
  // 사본을 형제로 나란히 그리면 둘째부터의 상호작용이 등록 밖이 된다 - FIN-EVID-01의
  // 결제 묶음 셋이 각각 '파일 추가'를 갖는 자리가 그렇다.
  //
  // 임자 없는 형제는 사본으로 본다: 명세가 임자를 밝힌 형제는 그 임자의 것이고(등록됐거나
  // 등록된 것을 품거나), 아무도 안 챙긴 같은 이름의 형제는 되풀이되는 틀의 다른 사본이다.
  const repeatedSources = new Set();
  for (const { element } of allElementsOf(spec)) {
    if (Array.isArray(element?.spec?.itemFields) && typeof element.source?.nodeId === "string") {
      repeatedSources.add(element.source.nodeId);
    }
  }
  const copies = new Set();
  const markCopies = (node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const first = children.find((child) => repeatedSources.has(child.id));
    if (first) {
      for (const sibling of children) {
        if (sibling.id === first.id) continue;
        if (sibling.name !== first.name) continue;
        if (registered.has(sibling.id) || holdsRegistered(sibling)) continue;
        copies.add(sibling.id);
      }
    }
    for (const child of children) markCopies(child);
  };

  const isInteraction = (node) =>
    DRAFT_SIGNALS.BUTTON_NAME_PATTERN.test(node.name ?? "") ||
    DRAFT_SIGNALS.CONTROL_NAMES.has(node.name ?? "");

  // 이름으로 빼는 것은 셸이다(왼쪽 사이드바). 그런데 **화면이 제 안쪽 패널에도
  // 같은 이름을 붙일 수 있다** — FIN-REQ-01의 요청 요약 패널이 'Sidebar'다.
  // 이름만 보고 빼면 그 안의 제출 버튼 셋이 통째로 검사 밖으로 나간다.
  // 화면이 그 안에 요소를 등록했으면 셸이 아니다.
  const holdsRegistered = (node) =>
    (Array.isArray(node?.children) ? node.children : []).some(
      (child) => registered.has(child.id) || holdsRegistered(child)
    );

  markCopies(root);

  const walk = (node, covered) => {
    for (const child of Array.isArray(node?.children) ? node.children : []) {
      if (excluded.has(child.name) && !holdsRegistered(child)) {
        continue;
      }
      const inside = covered || registered.has(child.id) || copies.has(child.id);
      if (!inside && isInteraction(child)) {
        const drawn = collectSubtreeText(child).join("").trim();
        // **글이 없다고 넘기지 않는다.** 켜고 끄는 칸은 제 안에 글을 담지 않는다 —
        // 체크 상자의 '동의합니다'는 형제고, 스위치와 빈 드롭다운은 아예 글이 없다.
        // 글이 있을 때만 알리면 그런 칸이 명세에서 통째로 빠져도 조용하다.
        findings.push({
          level: "error",
          file,
          message: `design의 ${drawn ? `'${drawn}'` : "글 없는 칸"}(${child.id} ${child.name})이 명세에 없습니다. 등록된 어느 요소 안에도 들어 있지 않습니다 — 화면의 동작이라면 요소로 등록하고, 다른 요소의 내부 조작이라면 그 요소의 nodeId가 이것을 품어야 합니다.`
        });
      }
      walk(child, inside);
    }
  };
  walk(root, false);
}

function checkScreenAgainstDesign(findings, screen, designEntry, shell) {
  const { file, spec } = screen;
  const design = designEntry?.design;
  if (!isObject(design)) {
    return;
  }

  if (design.screenId !== spec.screenId) {
    findings.push({
      level: "error",
      file: designEntry.file,
      message: `figma.design.json의 screenId(${design.screenId})가 화면(${spec.screenId})과 다릅니다.`
    });
  }

  // 화면 폴더의 신원(브리지가 쓰는 앵커)이 어긋나면 이후 저장이 409로 막힌다.
  if (
    typeof spec.source?.nodeId === "string" &&
    typeof design.root?.id === "string" &&
    spec.source.nodeId !== design.root.id
  ) {
    findings.push({
      level: "error",
      file,
      message: `화면 source.nodeId '${spec.source.nodeId}'가 figma.design.json의 루트 '${design.root.id}'와 다릅니다.`
    });
  }

  const nodeIds = collectDesignNodeIds(design.root);
  allElementsOf(spec).forEach(({ element }, index) => {
    const nodeId = element?.source?.nodeId;
    if (typeof nodeId === "string" && !nodeIds.has(nodeId)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 figma.design.json에 없습니다.`
      });
      return;
    }
    if (isObject(element?.spec)) {
      checkElementNodeCoverage(findings, { file, element, index, design });
    }
  });

  checkDesignInteractionCoverage(findings, file, spec, design, shell);

  const assetFiles = new Set(designEntry.assetFiles ?? []);
  for (const asset of Array.isArray(design.assets) ? design.assets : []) {
    const fileName = String(asset?.file ?? "").replace(/^assets\//, "");
    if (fileName && !assetFiles.has(fileName)) {
      findings.push({
        level: "error",
        file: designEntry.file,
        message: `자산 파일 '${asset.file}'이 assets 폴더에 없습니다.`
      });
    }
  }

  if (designEntry.hasReference === false) {
    findings.push({
      level: "warning",
      file: designEntry.file,
      message: "검증 기준 reference.png가 없습니다."
    });
  }
}

/** 화면 제목과 Figma 그림의 대조 결과. 화면의 다른 검사보다 먼저 수집한다. */
export function collectDesignTitleFindings({ file, spec, designEntry }) {
  const findings = [];
  if (isObject(spec.variantOf) && !isObject(spec.meta?.titleFrom)) {
    const title = spec.meta?.title;
    if (typeof title === "string" && isObject(designEntry)) {
      if (!designDrawsText(designEntry.design?.root ?? designEntry.root ?? designEntry, title)) {
        findings.push({
          level: "error",
          file,
          message: `제목 '${title}'을 그리라고 했는데 그림에 그 글이 없습니다. 제목이 데이터에서 오면 meta.titleFrom으로 말하고(바탕 화면이 그렇게 합니다), 그리는 글이 다르면 그림에 있는 글로 적으세요.`
        });
      }
    }
  }
  return findings;
}

/** 화면 요소·상호작용·자산과 Figma 그림의 대조 결과. */
export function collectScreenDesignFindings({ screen, designEntry, shell }) {
  const findings = [];
  checkScreenAgainstDesign(findings, screen, designEntry, shell);
  return findings;
}
