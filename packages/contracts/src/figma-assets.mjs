const VECTOR_ASSET_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION"]);

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 자산으로 뽑을 노드를 트리에서 모은다.
 *
 * 단위가 벡터 하나가 아니라 **벡터만 품은 가장 바깥 노드**다. 아이콘 하나는
 * 보통 벡터 여러 개로 그려지므로, 벡터마다 SVG를 뽑으면 조각이 나와 아무도
 * 쓸 수 없다 — HOME-01K는 아이콘 22개가 파일 61개로 흩어졌다. 판별은 이름이
 * 아니라 구조로 한다(제품마다 레이어 이름이 다르다).
 *
 * absoluteRenderBounds가 null이면 그 노드는 아무것도 그리지 않으며 Figma 자신이
 * export를 거부한다("Failed to export node. This node may not have any visible
 * layers."). 값이 없으면(undefined) 판정하지 않는다 — 옛 원본을 소급해서
 * 떨어뜨리면 이미 저장된 자산이 고아가 된다.
 *
 * 플러그인(추출)과 정규화기(참조)가 같은 함수를 써야 한다. 한쪽만 알면 참조는
 * 있는데 파일이 없거나, 파일은 있는데 참조가 없다.
 *
 * @returns {Array<{node: object, format: "svg"|"png"}>}
 */
export function collectAssetNodes(root) {
  const assets = [];
  // 틀은 화면 프레임이다. 이 밖으로 나간 것은 잘린 것이지 없는 것이 아니다.
  const frame = root?.absoluteBoundingBox;
  const visit = (node) => {
    // 숨긴 것은 Figma가 명시적으로 말해 준다(visible: false). 보이는 것에는
    // 이 값이 아예 없다. 렌더 범위와 달리 이것은 뜻이 흔들리지 않는다.
    if (!node || node.visible === false) {
      return;
    }
    if (hasImageFill(node)) {
      // 래스터는 벡터로 뽑을 수 없다. 노드를 그대로 그려 담는다.
      assets.push({ node, format: "png" });
      return;
    }
    if (
      hasVectorDescendant(node, frame) &&
      isVectorOnlySubtree(node, frame) &&
      !isSpreadApart(node)
    ) {
      assets.push({ node, format: "svg" });
      return;
    }
    for (const child of childNodes(node)) {
      visit(child);
    }
  };
  visit(root);
  return assets;
}

function childNodes(node) {
  return Array.isArray(node?.children) ? node.children : [];
}

export function hasImageFill(node) {
  return (Array.isArray(node?.fills) ? node.fills : []).some(
    (fill) => fill?.type === "IMAGE"
  );
}

// 틀(화면 프레임) 밖으로 삐져나갔는가. 화면 아래로 이어지는 내용이 그렇다.
function isClipped(node, frame) {
  const box = node?.absoluteBoundingBox;
  if (!box || !frame) {
    return false;
  }
  return (
    box.x < frame.x ||
    box.y < frame.y ||
    box.x + box.width > frame.x + frame.width ||
    box.y + box.height > frame.y + frame.height
  );
}

// **absoluteRenderBounds가 null인 것은 뜻이 둘이다.**
//
// 하나는 진짜로 아무것도 그리지 않는 것(Figma가 export를 거부한다). 다른 하나는
// **틀 밖으로 잘린 것** — 화면 프레임(1288×740)보다 아래에 있는 내용은 전부 그렇다.
// 둘을 가르지 않아서 접힌 아래쪽 아이콘이 자산에서 조용히 빠졌고(EVT-TASK-02의
// '파일 추가' 25:1822), 보이는 글이 '있으나 마나'로 읽혔다(글 500개 중 23개).
//
// 가르는 것은 좌표다. 잘린 것은 틀 경계를 넘어간다.
function rendersNothing(node, frame) {
  return node?.absoluteRenderBounds === null && !isClipped(node, frame);
}

// **absoluteRenderBounds가 null인 것은 '안 그린다'가 아니라 '틀 밖으로 잘렸다'다.**
//
// 화면 프레임(1288×740)보다 아래에 있는 것은 Figma가 렌더 범위를 주지 않는다.
// EVT-TASK-02의 '파일 추가' 아이콘(25:1822)은 Vector 셋을 품고 있는데도 그래서
// 자산에서 빠졌고, 글 500개 중 23개가 null이던 것도 같은 이유다.
//
// 그러므로 벡터를 품었는지는 렌더 범위로 판정하지 않는다. 잘린 것도 그림이다.
function hasVectorDescendant(node, frame) {
  if (VECTOR_ASSET_TYPES.has(node?.type)) {
    // 그리는 것이 없는 벡터는 Figma가 export를 거부한다. 잘린 것은 그리는 것이다.
    return !rendersNothing(node, frame);
  }
  return childNodes(node).some((child) => hasVectorDescendant(child, frame));
}

// 글은 그림이 아니다. **그리는 것이 없다는 판정에서 글은 뺀다.**
//
// Figma가 보이는 글에도 absoluteRenderBounds를 null로 주는 일이 있다(500개 중
// 23개, 채움도 있고 reference.png에도 그려져 있다). 그것을 '있으나 마나'로 읽으면
// 아이콘과 글이 나란한 줄이 통째로 한 자산이 된다 — OPS-MEET-01A의 `18:720`이
// 582×19짜리 한 덩이로 뽑힌 원인이다. 글이 그려지는지 Figma에게 묻지 않는다.
function isText(node) {
  return node?.type === "TEXT";
}

// 그리는 것이 없는 가지는 섞임을 만들지 않는다 — 있으나 마나이므로 아이콘
// 판정을 깨뜨려서도, 혼자 아이콘이 되어서도 안 된다.
function isVectorOnlySubtree(node, frame) {
  if (isText(node)) {
    return false;
  }
  const children = childNodes(node);
  if (children.length === 0) {
    // 잎이다. 벡터면 그림이고, 아무것도 그리지 않으면 있으나 마나다 — 있으나
    // 마나인 것이 아이콘 판정을 깨뜨려서는 안 된다.
    //
    // 이 판정을 잎에서만 한다. 위에서 하면 **틀 밖으로 잘린 가지가 통째로
    // 투명해진다** — EVT-TASK-02의 '파일 추가' 버튼은 아이콘과 글 둘인데,
    // 화면 아래로 잘려 렌더 범위가 없어 글까지 한 자산이 될 뻔했다.
    return VECTOR_ASSET_TYPES.has(node?.type) || rendersNothing(node, frame);
  }
  return children.every((child) => isVectorOnlySubtree(child, frame));
}

// 한 자산은 **붙어 있어야 한다.**
//
// 글이 사이에 없어도 자산이 아닌 것이 있다. OPS-00의 카드는 왼쪽 위 아이콘과
// 오른쪽 끝 화살표만 든 Container라 벡터만 품고 있지만, 둘 사이가 334px 비어
// 있다. 한 파일로 뽑으면 383×35가 되어 어느 자리에도 그릴 수 없다.
//
// 임계값은 재서 정했다. 자식이 둘 이상인 자산 111개의 '벌어진 비율'(가장 큰 틈 ÷
// 제 크기)을 보면 87%가 넷(전부 OPS-00의 그 카드), 나머지 107개는 전부 25% 이하다.
// 골이 깊어 절반에 그으면 어느 쪽도 아슬아슬하지 않다.
const SPREAD_LIMIT = 0.5;

function widestGap(children, axis, size) {
  const spans = children
    .map((child) => child?.absoluteBoundingBox)
    .filter((box) => box && isFiniteNumber(box[axis]) && isFiniteNumber(box[size]))
    .map((box) => [box[axis], box[axis] + box[size]])
    .sort((left, right) => left[0] - right[0]);
  let widest = 0;
  let reach = spans[0]?.[1] ?? 0;
  for (const [start, end] of spans.slice(1)) {
    widest = Math.max(widest, start - reach);
    reach = Math.max(reach, end);
  }
  return widest;
}

function isSpreadApart(node) {
  const children = childNodes(node);
  const box = node?.absoluteBoundingBox;
  if (children.length < 2 || !box) {
    return false;
  }
  const spreadX = box.width ? widestGap(children, "x", "width") / box.width : 0;
  const spreadY = box.height ? widestGap(children, "y", "height") / box.height : 0;
  return Math.max(spreadX, spreadY) >= SPREAD_LIMIT;
}
