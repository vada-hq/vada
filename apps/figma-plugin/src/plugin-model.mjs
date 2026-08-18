const INPUT_NODE_NAMES = new Set(["Input", "Text Input"]);
const ELEMENT_TYPE_OPTIONS = [
  { value: "input", label: "입력" },
  { value: "button", label: "버튼" },
  { value: "select", label: "선택" },
  { value: "note", label: "안내" },
  { value: "group", label: "묶음" },
  { value: "list", label: "목록" },
  { value: "summary", label: "요약" }
];
const PLACEHOLDER_OPACITY_THRESHOLD = 0.7;
const LABEL_MAX_VERTICAL_GAP = 24;

function getChildren(node) {
  return Array.isArray(node?.children) ? node.children : [];
}

function collectVisibleTextNodes(node, result) {
  if (!node || node.visible === false) {
    return;
  }

  if (node.type === "TEXT") {
    if (typeof node.characters === "string" && node.characters.trim()) {
      result.push(node);
    }
    return;
  }

  for (const child of getChildren(node)) {
    collectVisibleTextNodes(child, result);
  }
}

function extractOnlyVisibleText(node) {
  const textNodes = [];
  collectVisibleTextNodes(node, textNodes);

  return textNodes.length === 1
    ? textNodes[0].characters.trim()
    : undefined;
}

function extractLabelFromDirectChild(node) {
  const labelBranches = getChildren(node).filter(
    (child) => child.name === "Label"
  );

  return labelBranches.length === 1
    ? extractOnlyVisibleText(labelBranches[0])
    : undefined;
}

function collectInputDescendants(node, result) {
  for (const child of getChildren(node)) {
    if (INPUT_NODE_NAMES.has(child.name)) {
      result.push(child);
      continue;
    }

    collectInputDescendants(child, result);
  }
}

function findInputSuggestionTarget(node) {
  if (INPUT_NODE_NAMES.has(node?.name)) {
    return node;
  }

  const descendants = [];
  collectInputDescendants(node, descendants);

  return descendants.length === 1 ? descendants[0] : null;
}

function getTextOwnOpacity(textNode) {
  const nodeOpacity =
    typeof textNode.opacity === "number" ? textNode.opacity : 1;
  const visibleFills = Array.isArray(textNode.fills)
    ? textNode.fills.filter((fill) => fill?.visible !== false)
    : [];
  const fillOpacity =
    visibleFills.length > 0
      ? Math.min(
          ...visibleFills.map((fill) =>
            typeof fill.opacity === "number" ? fill.opacity : 1
          )
        )
      : 1;

  return nodeOpacity * fillOpacity;
}

function extractInputTextSuggestion(node) {
  const textNodes = [];
  collectVisibleTextNodes(node, textNodes);

  if (textNodes.length !== 1) {
    return null;
  }

  const textNode = textNodes[0];
  const value = textNode.characters.trim();

  return getTextOwnOpacity(textNode) < PLACEHOLDER_OPACITY_THRESHOLD
    ? { suggestedPlaceholder: value }
    : { suggestedInitialValue: value };
}

function getLabelCandidateDistance(textNode, selectedNode) {
  const textBox = textNode.absoluteBoundingBox;
  const selectedBox = selectedNode.absoluteBoundingBox;

  if (!textBox || !selectedBox) {
    return undefined;
  }

  const verticalGap = selectedBox.y - (textBox.y + textBox.height);
  const overlapsHorizontally =
    textBox.x < selectedBox.x + selectedBox.width &&
    selectedBox.x < textBox.x + textBox.width;

  if (
    !overlapsHorizontally ||
    verticalGap < 0 ||
    verticalGap > LABEL_MAX_VERTICAL_GAP
  ) {
    return undefined;
  }

  const textCenterX = textBox.x + textBox.width / 2;
  const selectedCenterX = selectedBox.x + selectedBox.width / 2;

  return {
    verticalGap,
    horizontalDistance: Math.abs(textCenterX - selectedCenterX)
  };
}

function isScreenBoundary(node) {
  return (
    node?.type === "FRAME" &&
    (node.parent?.type === "PAGE" || node.parent?.type === "SECTION")
  );
}

export function extractLabelFromDirectParent(node) {
  if (!node?.absoluteBoundingBox) {
    return undefined;
  }

  let selectedBranch = node;
  let ancestor = node.parent;

  while (ancestor && ancestor.type !== "PAGE") {
    const candidates = [];

    for (const siblingBranch of getChildren(ancestor)) {
      if (siblingBranch === selectedBranch) {
        continue;
      }

      const textNodes = [];
      collectVisibleTextNodes(siblingBranch, textNodes);

      for (const textNode of textNodes) {
        const distance = getLabelCandidateDistance(textNode, node);

        if (distance) {
          candidates.push({
            text: textNode.characters.trim(),
            ...distance
          });
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort(
        (left, right) =>
          left.verticalGap - right.verticalGap ||
          left.horizontalDistance - right.horizontalDistance ||
          left.text.localeCompare(right.text, "ko")
      );

      return candidates[0].text;
    }

    if (isScreenBoundary(ancestor)) {
      break;
    }

    selectedBranch = ancestor;
    ancestor = ancestor.parent;
  }

  return undefined;
}

export function parseLabelRequirement(labelText) {
  const label = labelText.trim();
  const required = label.endsWith("*");

  return {
    label: required ? label.slice(0, -1).trimEnd() : label,
    required
  };
}

export function findInputElement(node) {
  let current = node;

  while (current) {
    if (INPUT_NODE_NAMES.has(current.name)) {
      return current;
    }

    current = current.parent ?? null;
  }

  return null;
}

export function getSchemaPropertyKeys(schema) {
  if (!schema || typeof schema.properties !== "object" || !schema.properties) {
    throw new TypeError("JSON Schema에 properties가 필요합니다.");
  }

  return Object.keys(schema.properties);
}

export function getSchemaPropertyKeysForElementType(
  elementType,
  schemaByType
) {
  const schema = schemaByType[elementType];

  return schema ? getSchemaPropertyKeys(schema) : [];
}

export function getSchemaConstantValue(schema, propertyKey) {
  const property = schema?.properties?.[propertyKey];

  if (
    !property ||
    !Object.prototype.hasOwnProperty.call(property, "const")
  ) {
    return undefined;
  }

  return property.const;
}

export function getSchemaEnumValues(schema, propertyKey) {
  const values = schema?.properties?.[propertyKey]?.enum;

  return Array.isArray(values) ? [...values] : [];
}

export function getSelectedNodeInfo(node) {
  if (!node) {
    return null;
  }

  const nodeInfo = {
    nodeId: node.id,
    name: node.name,
    type: node.type
  };

  const observedLabel =
    extractLabelFromDirectChild(node) ??
    extractLabelFromDirectParent(node);

  if (observedLabel !== undefined) {
    const labelRequirement = parseLabelRequirement(observedLabel);
    nodeInfo.suggestedLabel = labelRequirement.label;
    nodeInfo.suggestedRequired = labelRequirement.required;
  }

  const inputTextSuggestionTarget = findInputSuggestionTarget(node);
  const inputTextSuggestion = inputTextSuggestionTarget
    ? extractInputTextSuggestion(inputTextSuggestionTarget)
    : null;

  if (inputTextSuggestion) {
    Object.assign(nodeInfo, inputTextSuggestion);
  }

  return nodeInfo;
}

export function getElementTypeOptions() {
  return ELEMENT_TYPE_OPTIONS.map((option) => ({ ...option }));
}
