const DEFAULT_CONSTRAINTS = {
  horizontal: "LEFT",
  vertical: "TOP"
};

const VECTOR_ASSET_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION"]);

/**
 * 벡터 자산으로 뽑을 수 있는 노드인가.
 *
 * 유형만으로는 부족하다. absoluteRenderBounds가 null이면 그 노드는 실제로
 * 아무것도 그리지 않으며 Figma 자신이 export를 거부한다:
 *   "Failed to export node. This node may not have any visible layers."
 * HOME-01K의 벡터 64개 중 3개가 그랬고, 등록된 화면을 전부 대조해도
 * null인 벡터는 그 셋뿐이었다.
 *
 * 값이 없으면(undefined) 판정하지 않는다 — 옛 원본을 소급해서 자산에서
 * 떨어뜨리면 이미 저장된 SVG가 고아가 된다.
 *
 * 플러그인(추출)과 정규화기(참조)가 같은 규칙을 써야 한다. 한쪽만 알면
 * 참조는 있는데 파일이 없거나, 파일은 있는데 참조가 없다.
 */
export function isVectorAssetNode(node) {
  if (!VECTOR_ASSET_TYPES.has(node?.type)) {
    return false;
  }
  return node.absoluteRenderBounds !== null;
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
    const placement = {};
    if (isFiniteNumber(node.gridRowAnchorIndex)) {
      placement.row = node.gridRowAnchorIndex;
    }
    if (isFiniteNumber(node.gridColumnAnchorIndex)) {
      placement.column = node.gridColumnAnchorIndex;
    }
    if (isFiniteNumber(node.gridRowSpan) && node.gridRowSpan !== 1) {
      placement.rowSpan = node.gridRowSpan;
    }
    if (isFiniteNumber(node.gridColumnSpan) && node.gridColumnSpan !== 1) {
      placement.columnSpan = node.gridColumnSpan;
    }
    if (node.gridChildHorizontalAlign !== "AUTO") {
      placement.horizontalAlign = lower(node.gridChildHorizontalAlign);
    }
    if (node.gridChildVerticalAlign !== "AUTO") {
      placement.verticalAlign = lower(node.gridChildVerticalAlign);
    }
    layout.gridPlacement = placement;
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

export function figmaAssetFileName(nodeId) {
  return `${String(nodeId).replace(/[^a-zA-Z0-9._-]/g, "-")}.svg`;
}

function assetFileForNode(nodeId) {
  return `assets/${figmaAssetFileName(nodeId)}`;
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

  if (isVectorAssetNode(node)) {
    const file = assetFileForNode(node.id);
    normalized.assetRef = file;
    if (!assets.has(node.id)) {
      assets.set(node.id, { nodeId: node.id, format: "svg", file });
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

  const assets = new Map();
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
    assets: [...assets.values()]
  };
}
