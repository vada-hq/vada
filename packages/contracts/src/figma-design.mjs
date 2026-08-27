const DEFAULT_CONSTRAINTS = {
  horizontal: "LEFT",
  vertical: "TOP"
};

const VECTOR_ASSET_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION"]);

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

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function lower(value) {
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

function hasKeys(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

function normalizeColor(color) {
  if (!isObject(color)) {
    return undefined;
  }

  const channels = [color.r, color.g, color.b];
  if (!channels.every(isFiniteNumber)) {
    return undefined;
  }

  return `#${channels
    .map((channel) =>
      Math.round(Math.max(0, Math.min(1, channel)) * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    )
    .join("")}`;
}

function normalizePaint(paint) {
  if (!isObject(paint) || typeof paint.type !== "string") {
    return undefined;
  }

  const normalized = { type: lower(paint.type) };
  const color = normalizeColor(paint.color);
  if (color) {
    normalized.color = color;
  }

  const colorOpacity = isFiniteNumber(paint.color?.a) ? paint.color.a : 1;
  const paintOpacity = isFiniteNumber(paint.opacity) ? paint.opacity : 1;
  const opacity = round(colorOpacity * paintOpacity);
  if (opacity !== 1) {
    normalized.opacity = opacity;
  }

  if (paint.visible === false) {
    normalized.visible = false;
  }
  if (paint.blendMode && paint.blendMode !== "NORMAL") {
    normalized.blendMode = lower(paint.blendMode);
  }
  if (typeof paint.imageRef === "string") {
    normalized.imageRef = paint.imageRef;
  }
  if (typeof paint.scaleMode === "string") {
    normalized.scaleMode = lower(paint.scaleMode);
  }
  if (isFiniteNumber(paint.rotation) && paint.rotation !== 0) {
    normalized.rotation = round(paint.rotation);
  }
  if (isFiniteNumber(paint.scalingFactor)) {
    normalized.scalingFactor = round(paint.scalingFactor);
  }

  if (Array.isArray(paint.gradientStops) && paint.gradientStops.length > 0) {
    normalized.stops = paint.gradientStops.map((stop) => {
      const normalizedStop = { position: round(stop.position) };
      const stopColor = normalizeColor(stop.color);
      if (stopColor) {
        normalizedStop.color = stopColor;
      }
      if (isFiniteNumber(stop.color?.a) && stop.color.a !== 1) {
        normalizedStop.opacity = round(stop.color.a);
      }
      return normalizedStop;
    });
  }
  if (
    Array.isArray(paint.gradientHandlePositions) &&
    paint.gradientHandlePositions.length > 0
  ) {
    normalized.handles = paint.gradientHandlePositions.map((position) => ({
      x: round(position.x),
      y: round(position.y)
    }));
  }

  return normalized;
}

function normalizePaints(paints) {
  if (!Array.isArray(paints) || paints.length === 0) {
    return undefined;
  }

  const normalized = paints.map(normalizePaint).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeEffects(effects) {
  if (!Array.isArray(effects) || effects.length === 0) {
    return undefined;
  }

  return effects.map((effect) => {
    const normalized = { type: lower(effect.type) };
    if (effect.visible === false) {
      normalized.visible = false;
    }
    if (isFiniteNumber(effect.radius)) {
      normalized.radius = round(effect.radius);
    }
    if (isFiniteNumber(effect.spread)) {
      normalized.spread = round(effect.spread);
    }
    if (isObject(effect.offset)) {
      normalized.offset = {
        x: round(effect.offset.x),
        y: round(effect.offset.y)
      };
    }
    const color = normalizeColor(effect.color);
    if (color) {
      normalized.color = color;
      if (isFiniteNumber(effect.color.a) && effect.color.a !== 1) {
        normalized.opacity = round(effect.color.a);
      }
    }
    if (effect.blendMode && effect.blendMode !== "NORMAL") {
      normalized.blendMode = lower(effect.blendMode);
    }
    return normalized;
  });
}

function clampCornerRadius(value, bounds) {
  if (
    !isObject(bounds) ||
    !isFiniteNumber(bounds.width) ||
    !isFiniteNumber(bounds.height)
  ) {
    return round(value);
  }

  const maxRadius = Math.min(bounds.width, bounds.height) / 2;
  return round(Math.max(0, Math.min(value, maxRadius)));
}

function normalizeBox(bounds, parentBounds) {
  if (!isObject(bounds)) {
    return undefined;
  }

  const required = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!required.every(isFiniteNumber)) {
    return undefined;
  }

  return {
    x: round(parentBounds ? bounds.x - parentBounds.x : 0),
    y: round(parentBounds ? bounds.y - parentBounds.y : 0),
    width: round(bounds.width),
    height: round(bounds.height)
  };
}

function normalizeLayout(node) {
  const layout = {};

  if (node.layoutMode && node.layoutMode !== "NONE") {
    layout.mode = lower(node.layoutMode);
  }

  const sizing = {};
  if (node.layoutSizingHorizontal) {
    sizing.horizontal = lower(node.layoutSizingHorizontal);
  }
  if (node.layoutSizingVertical) {
    sizing.vertical = lower(node.layoutSizingVertical);
  }
  if (node.primaryAxisSizingMode) {
    sizing.primaryAxis = lower(node.primaryAxisSizingMode);
  }
  if (node.counterAxisSizingMode) {
    sizing.counterAxis = lower(node.counterAxisSizingMode);
  }
  if (hasKeys(sizing)) {
    layout.sizing = sizing;
  }

  const alignment = {};
  if (node.primaryAxisAlignItems) {
    alignment.primaryAxis = lower(node.primaryAxisAlignItems);
  }
  if (node.counterAxisAlignItems) {
    alignment.counterAxis = lower(node.counterAxisAlignItems);
  }
  if (node.layoutAlign && node.layoutAlign !== "INHERIT") {
    alignment.self = lower(node.layoutAlign);
  }
  if (hasKeys(alignment)) {
    layout.alignment = alignment;
  }

  if (isFiniteNumber(node.layoutGrow) && node.layoutGrow > 0) {
    layout.grow = 1;
  }
  if (node.layoutPositioning && node.layoutPositioning !== "AUTO") {
    layout.positioning = lower(node.layoutPositioning);
  }
  if (isFiniteNumber(node.itemSpacing) && node.itemSpacing !== 0) {
    layout.gap = round(node.itemSpacing);
  }
  if (
    isFiniteNumber(node.counterAxisSpacing) &&
    node.counterAxisSpacing !== 0
  ) {
    layout.crossGap = round(node.counterAxisSpacing);
  }

  if (
    node.strokesIncludedInLayout === true &&
    node.layoutMode &&
    node.layoutMode !== "NONE" &&
    Array.isArray(node.strokes) &&
    node.strokes.length > 0
  ) {
    layout.strokesIncludedInLayout = true;
  }

  const paddingValues = [
    node.paddingTop,
    node.paddingRight,
    node.paddingBottom,
    node.paddingLeft
  ];
  if (paddingValues.some((value) => isFiniteNumber(value) && value !== 0)) {
    layout.padding = {
      top: round(node.paddingTop ?? 0),
      right: round(node.paddingRight ?? 0),
      bottom: round(node.paddingBottom ?? 0),
      left: round(node.paddingLeft ?? 0)
    };
  }

  const overflowByDirection = {
    HORIZONTAL_SCROLLING: "horizontal",
    VERTICAL_SCROLLING: "vertical",
    HORIZONTAL_AND_VERTICAL_SCROLLING: "both"
  };
  if (overflowByDirection[node.overflowDirection]) {
    layout.overflow = overflowByDirection[node.overflowDirection];
  }
  if (node.layoutWrap && node.layoutWrap !== "NO_WRAP") {
    layout.wrap = lower(node.layoutWrap);
  }

  const constraints = node.constraints;
  if (
    isObject(constraints) &&
    (constraints.horizontal !== DEFAULT_CONSTRAINTS.horizontal ||
      constraints.vertical !== DEFAULT_CONSTRAINTS.vertical)
  ) {
    layout.constraints = {
      horizontal: lower(constraints.horizontal),
      vertical: lower(constraints.vertical)
    };
  }

  if (node.layoutMode === "GRID") {
    const grid = {};
    if (isFiniteNumber(node.gridColumnCount)) {
      grid.columns = node.gridColumnCount;
    }
    if (isFiniteNumber(node.gridRowCount)) {
      grid.rows = node.gridRowCount;
    }
    if (isFiniteNumber(node.gridColumnGap) && node.gridColumnGap !== 0) {
      grid.columnGap = round(node.gridColumnGap);
    }
    if (isFiniteNumber(node.gridRowGap) && node.gridRowGap !== 0) {
      grid.rowGap = round(node.gridRowGap);
    }
    if (typeof node.gridColumnsSizing === "string") {
      grid.columnsSizing = node.gridColumnsSizing.trim();
    }
    if (typeof node.gridRowsSizing === "string") {
      grid.rowsSizing = node.gridRowsSizing.trim();
    }
    if (node.gridAutoTracks && node.gridAutoTracks !== "NONE") {
      grid.autoTracks = lower(node.gridAutoTracks);
    }
    if (node.gridItemsPositioning) {
      grid.itemsPositioning = lower(node.gridItemsPositioning);
    }
    if (hasKeys(grid)) {
      layout.grid = grid;
    }
  }

  if (
    isFiniteNumber(node.gridRowAnchorIndex) ||
    isFiniteNumber(node.gridColumnAnchorIndex)
  ) {
    // Figma는 **격자에 놓이지 않은 것**을 -1로 말한다(절대 위치로 띄운 노드가
    // 그렇다). 그것을 자리로 적으면 '-1번째 칸'이라는 거짓이 되므로 적지 않는다.
    // ORG-04B의 오른쪽 칸이 그랬고, 스키마가 minimum 0이라 저장이 막혔다.
    const placement = {};
    if (isFiniteNumber(node.gridRowAnchorIndex) && node.gridRowAnchorIndex >= 0) {
      placement.row = node.gridRowAnchorIndex;
    }
    if (isFiniteNumber(node.gridColumnAnchorIndex) && node.gridColumnAnchorIndex >= 0) {
      placement.column = node.gridColumnAnchorIndex;
    }
    if (isFiniteNumber(node.gridRowSpan) && node.gridRowSpan !== 1) {
      placement.rowSpan = node.gridRowSpan;
    }
    if (isFiniteNumber(node.gridColumnSpan) && node.gridColumnSpan !== 1) {
      placement.columnSpan = node.gridColumnSpan;
    }
    // **없는 것과 AUTO는 다르다.** 'AUTO가 아니면 적는다'로만 보면 속성이 아예
    // 없을 때도 undefined를 적게 된다(JSON으로 나갈 때 사라져 오랫동안 안 보였다).
    if (typeof node.gridChildHorizontalAlign === "string" && node.gridChildHorizontalAlign !== "AUTO") {
      placement.horizontalAlign = lower(node.gridChildHorizontalAlign);
    }
    if (typeof node.gridChildVerticalAlign === "string" && node.gridChildVerticalAlign !== "AUTO") {
      placement.verticalAlign = lower(node.gridChildVerticalAlign);
    }
    // 자리도 없고 붙는 방향도 없으면 격자 이야기가 아예 없는 것이다.
    if (Object.keys(placement).length > 0) {
      layout.gridPlacement = placement;
    }
  }

  const limits = {};
  for (const [sourceKey, targetKey] of [
    ["minWidth", "minWidth"],
    ["maxWidth", "maxWidth"],
    ["minHeight", "minHeight"],
    ["maxHeight", "maxHeight"]
  ]) {
    if (isFiniteNumber(node[sourceKey])) {
      limits[targetKey] = round(node[sourceKey]);
    }
  }
  if (hasKeys(limits)) {
    layout.limits = limits;
  }

  return hasKeys(layout) ? layout : undefined;
}

function normalizeAppearance(node) {
  const appearance = {};
  const fills = normalizePaints(
    Array.isArray(node.fills) ? node.fills : node.background
  );
  const strokes = normalizePaints(node.strokes);
  const effects = normalizeEffects(node.effects);

  if (fills) {
    appearance.fills = fills;
  }
  if (strokes) {
    appearance.strokes = strokes;

    const stroke = {};
    if (isFiniteNumber(node.strokeWeight)) {
      stroke.weight = round(node.strokeWeight);
    }
    if (node.strokeAlign) {
      stroke.align = lower(node.strokeAlign);
    }
    if (node.strokeJoin) {
      stroke.join = lower(node.strokeJoin);
    }
    if (node.strokeCap) {
      stroke.cap = lower(node.strokeCap);
    }
    if (Array.isArray(node.dashPattern) && node.dashPattern.length > 0) {
      stroke.dashPattern = node.dashPattern.map(round);
    }
    if (hasKeys(stroke)) {
      appearance.stroke = stroke;
    }
  }
  if (effects) {
    appearance.effects = effects;
  }
  if (isFiniteNumber(node.opacity) && node.opacity !== 1) {
    appearance.opacity = round(node.opacity);
  }
  if (node.blendMode && !["NORMAL", "PASS_THROUGH"].includes(node.blendMode)) {
    appearance.blendMode = lower(node.blendMode);
  }
  if (node.clipsContent === true) {
    appearance.clipsContent = true;
  }
  if (node.isMask === true) {
    appearance.mask = true;
  }
  if (node.visible === false) {
    appearance.visible = false;
  }
  const cornerRadius = isFiniteNumber(node.cornerRadius)
    ? clampCornerRadius(node.cornerRadius, node.absoluteBoundingBox)
    : undefined;
  if (cornerRadius !== undefined && cornerRadius !== 0) {
    appearance.cornerRadius = cornerRadius;
  } else if (Array.isArray(node.rectangleCornerRadii)) {
    const cornerRadii = node.rectangleCornerRadii.map((radius) =>
      isFiniteNumber(radius)
        ? clampCornerRadius(radius, node.absoluteBoundingBox)
        : 0
    );
    if (cornerRadii.some((radius) => radius !== 0)) {
      appearance.cornerRadii = cornerRadii;
    }
  }

  return hasKeys(appearance) ? appearance : undefined;
}

function normalizeTextStyle(style) {
  if (!isObject(style)) {
    return undefined;
  }

  const normalized = {};
  for (const key of ["fontFamily", "fontStyle"]) {
    if (typeof style[key] === "string") {
      normalized[key] = style[key];
    }
  }
  for (const key of ["fontWeight", "fontSize"]) {
    if (isFiniteNumber(style[key])) {
      normalized[key] = round(style[key]);
    }
  }
  if (style.textAlignHorizontal) {
    normalized.horizontalAlign = lower(style.textAlignHorizontal);
  }
  if (style.textAlignVertical) {
    normalized.verticalAlign = lower(style.textAlignVertical);
  }
  if (style.textAutoResize) {
    normalized.autoResize = lower(style.textAutoResize);
  }
  if (isFiniteNumber(style.letterSpacing) && style.letterSpacing !== 0) {
    normalized.letterSpacing = round(style.letterSpacing);
  }

  if (style.lineHeightUnit === "AUTO") {
    normalized.lineHeight = { unit: "auto" };
  } else if (isFiniteNumber(style.lineHeightPx)) {
    normalized.lineHeight = {
      value: round(style.lineHeightPx),
      unit: lower(style.lineHeightUnit ?? "PIXELS")
    };
  }

  if (style.textCase && style.textCase !== "ORIGINAL") {
    normalized.textCase = lower(style.textCase);
  }
  if (style.textDecoration && style.textDecoration !== "NONE") {
    normalized.textDecoration = lower(style.textDecoration);
  }
  if (isFiniteNumber(style.paragraphSpacing) && style.paragraphSpacing !== 0) {
    normalized.paragraphSpacing = round(style.paragraphSpacing);
  }
  if (isFiniteNumber(style.paragraphIndent) && style.paragraphIndent !== 0) {
    normalized.paragraphIndent = round(style.paragraphIndent);
  }

  return hasKeys(normalized) ? normalized : undefined;
}

function normalizeTextRunStyle(style) {
  if (!isObject(style)) {
    return undefined;
  }

  const normalized = normalizeTextStyle(style) ?? {};
  const fills = normalizePaints(style.fills);
  const strokes = normalizePaints(style.strokes);
  if (fills) {
    normalized.fills = fills;
  }
  if (strokes) {
    normalized.strokes = strokes;
  }
  if (isObject(style.hyperlink)) {
    normalized.hyperlink = { ...style.hyperlink };
  }
  return hasKeys(normalized) ? normalized : undefined;
}

function normalizeTextRuns(node) {
  const overrides = node.characterStyleOverrides;
  const table = node.styleOverrideTable;
  if (!Array.isArray(overrides) || !isObject(table)) {
    return undefined;
  }

  const runs = [];
  let start = 0;
  let current = overrides[0] ?? 0;

  const appendRun = (end) => {
    if (current === 0) {
      return;
    }
    const style = normalizeTextRunStyle(table[String(current)]);
    if (style) {
      runs.push({ start, end, style });
    }
  };

  for (let index = 1; index <= overrides.length; index += 1) {
    const next = index < overrides.length ? overrides[index] : undefined;
    if (next === current) {
      continue;
    }
    appendRun(index);
    start = index;
    current = next;
  }

  return runs.length > 0 ? runs : undefined;
}

function normalizeText(node) {
  if (node.type !== "TEXT") {
    return undefined;
  }

  const text = {
    content: typeof node.characters === "string" ? node.characters : ""
  };
  const style = normalizeTextStyle(node.style);
  const runs = normalizeTextRuns(node);
  if (style) {
    text.style = style;
  }
  if (runs) {
    text.runs = runs;
  }
  return text;
}

export function figmaAssetFileName(nodeId, format = "svg") {
  return `${String(nodeId).replace(/[^a-zA-Z0-9._-]/g, "-")}.${format}`;
}

function assetFileForNode(nodeId, format) {
  return `assets/${figmaAssetFileName(nodeId, format)}`;
}

function normalizeComponentReference(node) {
  const component = {};
  if (typeof node.componentId === "string") {
    component.id = node.componentId;
  }
  if (isObject(node.componentProperties) && hasKeys(node.componentProperties)) {
    component.properties = structuredClone(node.componentProperties);
  }
  return hasKeys(component) ? component : undefined;
}

function normalizeNode(node, parentBounds, assets) {
  const normalized = {
    id: node.id,
    type: lower(node.type),
    name: node.name
  };
  const box = normalizeBox(node.absoluteBoundingBox, parentBounds);
  const layout = normalizeLayout(node);
  const appearance = normalizeAppearance(node);
  const text = normalizeText(node);
  const component = normalizeComponentReference(node);

  if (box) {
    normalized.box = box;
    if (isFiniteNumber(node.rotation) && node.rotation !== 0) {
      normalized.box.rotation = round(node.rotation);
    }
  }
  if (layout) {
    normalized.layout = layout;
  }
  if (appearance) {
    normalized.appearance = appearance;
  }
  if (text) {
    normalized.text = text;
  }
  if (component) {
    normalized.component = component;
  }

  const assetFormat = assets.formatByNodeId.get(node.id);
  if (assetFormat) {
    const file = assetFileForNode(node.id, assetFormat);
    normalized.assetRef = file;
    if (!assets.entries.has(node.id)) {
      assets.entries.set(node.id, { nodeId: node.id, format: assetFormat, file });
    }
  }

  if (Array.isArray(node.children) && node.children.length > 0) {
    normalized.children = node.children.map((child) =>
      normalizeNode(child, node.absoluteBoundingBox ?? parentBounds, assets)
    );
  }

  return normalized;
}

function assertRawDocument(raw) {
  if (!isObject(raw) || !isObject(raw.document)) {
    throw new TypeError("Figma 원본의 document가 필요합니다.");
  }
  if (
    typeof raw.document.id !== "string" ||
    typeof raw.document.type !== "string" ||
    typeof raw.document.name !== "string"
  ) {
    throw new TypeError("Figma document의 id, type, name이 필요합니다.");
  }
  if (!normalizeBox(raw.document.absoluteBoundingBox)) {
    throw new TypeError("Figma document의 absoluteBoundingBox가 필요합니다.");
  }
}

export function normalizeFigmaDesign(raw, options = {}) {
  const screenId = options.screenId?.trim();
  if (!screenId) {
    throw new TypeError("screenId가 필요합니다.");
  }
  assertRawDocument(raw);

  const assets = {
    formatByNodeId: new Map(
      collectAssetNodes(raw.document).map((asset) => [asset.node.id, asset.format])
    ),
    entries: new Map()
  };
  const rootBounds = raw.document.absoluteBoundingBox;
  const root = normalizeNode(raw.document, undefined, assets);

  const source = {
    format: "JSON_REST_V1",
    nodeId: raw.document.id,
    rawFile: options.rawFile ?? "figma.raw.json"
  };
  if (typeof options.sourceHash === "string" && options.sourceHash.length > 0) {
    source.hash = options.sourceHash;
  }

  return {
    schemaVersion: 1,
    screenId,
    source,
    viewport: {
      width: round(rootBounds.width),
      height: round(rootBounds.height)
    },
    root,
    assets: [...assets.entries.values()]
  };
}
