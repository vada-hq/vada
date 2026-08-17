export const DOCUMENT_CONTEXT_PLUGIN_DATA_KEY = "document-context";
export const SCREEN_CONTEXT_PLUGIN_DATA_KEY = "screen-context";

const CONTEXT_VERSION = 1;

function parseJsonObject(value) {
  if (typeof value !== "string" || value === "") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function parseDocumentContext(value) {
  const parsed = parseJsonObject(value);

  if (
    parsed?.version !== CONTEXT_VERSION ||
    typeof parsed.wireframeKey !== "string" ||
    !parsed.wireframeKey.trim() ||
    !(
      typeof parsed.activeScreenNodeId === "string" ||
      parsed.activeScreenNodeId === null
    )
  ) {
    return null;
  }

  return {
    version: CONTEXT_VERSION,
    wireframeKey: parsed.wireframeKey.trim(),
    activeScreenNodeId: parsed.activeScreenNodeId
  };
}

function parseScreenRegistration(value) {
  const parsed = parseJsonObject(value);

  if (
    parsed?.version !== CONTEXT_VERSION ||
    typeof parsed.screenId !== "string" ||
    !parsed.screenId.trim()
  ) {
    return null;
  }

  return {
    version: CONTEXT_VERSION,
    screenId: parsed.screenId.trim()
  };
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${fieldName} 값이 필요합니다.`);
  }

  return value.trim();
}

function findContainingPage(node) {
  let current = node;

  while (current && current.type !== "PAGE") {
    current = current.parent ?? null;
  }

  return current;
}

export function suggestScreenId(nodeName) {
  if (typeof nodeName !== "string") {
    return "";
  }

  return nodeName.match(/\b[A-Za-z][A-Za-z0-9]*-\d+\b/)?.[0] ?? "";
}

export function createScreenSource(screenNode) {
  if (!screenNode || screenNode.type !== "FRAME") {
    throw new TypeError("작업 화면은 FRAME이어야 합니다.");
  }

  const page = findContainingPage(screenNode);

  if (!page) {
    throw new TypeError("작업 화면이 속한 페이지를 찾을 수 없습니다.");
  }

  return {
    pageName: page.name,
    nodeId: screenNode.id,
    nodeName: screenNode.name,
    nodeType: screenNode.type
  };
}

export function getSelectionScope(selectedNode, activeScreenNode) {
  if (!selectedNode) {
    return "none";
  }

  if (!activeScreenNode) {
    return "no-active-screen";
  }

  if (selectedNode.id === activeScreenNode.id) {
    return "screen";
  }

  let current = selectedNode.parent ?? null;

  while (current) {
    if (current.id === activeScreenNode.id) {
      return "inside";
    }

    current = current.parent ?? null;
  }

  return "outside";
}

export function getRegisteredScreenId(node) {
  if (!node || typeof node.getPluginData !== "function") {
    return "";
  }

  return (
    parseScreenRegistration(
      node.getPluginData(SCREEN_CONTEXT_PLUGIN_DATA_KEY)
    )?.screenId ?? ""
  );
}

export function getScreenCandidate(selectedNode, selectionScope) {
  if (
    !selectedNode ||
    selectedNode.type !== "FRAME" ||
    !["no-active-screen", "outside"].includes(selectionScope)
  ) {
    return null;
  }

  return {
    source: createScreenSource(selectedNode),
    suggestedScreenId:
      getRegisteredScreenId(selectedNode) ||
      suggestScreenId(selectedNode.name)
  };
}

export function registerActiveScreen({
  root,
  screenNode,
  wireframeKey,
  screenId
}) {
  if (!root || typeof root.setPluginData !== "function") {
    throw new TypeError("Figma 문서 루트가 필요합니다.");
  }

  if (
    !screenNode ||
    screenNode.type !== "FRAME" ||
    typeof screenNode.setPluginData !== "function"
  ) {
    throw new TypeError("작업 화면으로 선택한 FRAME이 필요합니다.");
  }

  const normalizedWireframeKey = requireNonEmptyString(
    wireframeKey,
    "wireframeKey"
  );
  const normalizedScreenId = requireNonEmptyString(screenId, "screenId");

  screenNode.setPluginData(
    SCREEN_CONTEXT_PLUGIN_DATA_KEY,
    JSON.stringify({
      version: CONTEXT_VERSION,
      screenId: normalizedScreenId
    })
  );
  root.setPluginData(
    DOCUMENT_CONTEXT_PLUGIN_DATA_KEY,
    JSON.stringify({
      version: CONTEXT_VERSION,
      wireframeKey: normalizedWireframeKey,
      activeScreenNodeId: screenNode.id
    })
  );

  return {
    wireframeKey: normalizedWireframeKey,
    activeScreenNode: screenNode,
    activeScreen: {
      screenId: normalizedScreenId,
      source: createScreenSource(screenNode)
    }
  };
}

export async function restoreScreenContext({ root, getNodeByIdAsync }) {
  if (!root || typeof root.getPluginData !== "function") {
    throw new TypeError("Figma 문서 루트가 필요합니다.");
  }

  const documentContext = parseDocumentContext(
    root.getPluginData(DOCUMENT_CONTEXT_PLUGIN_DATA_KEY)
  );

  if (!documentContext) {
    return {
      wireframeKey: "",
      activeScreenNode: null,
      activeScreen: null
    };
  }

  if (!documentContext.activeScreenNodeId) {
    return {
      wireframeKey: documentContext.wireframeKey,
      activeScreenNode: null,
      activeScreen: null
    };
  }

  const screenNode = await getNodeByIdAsync(
    documentContext.activeScreenNodeId
  );
  const screenRegistration = parseScreenRegistration(
    screenNode?.getPluginData?.(SCREEN_CONTEXT_PLUGIN_DATA_KEY) ?? ""
  );

  if (!screenNode || screenNode.type !== "FRAME" || !screenRegistration) {
    if (typeof root.setPluginData === "function") {
      root.setPluginData(
        DOCUMENT_CONTEXT_PLUGIN_DATA_KEY,
        JSON.stringify({
          ...documentContext,
          activeScreenNodeId: null
        })
      );
    }

    return {
      wireframeKey: documentContext.wireframeKey,
      activeScreenNode: null,
      activeScreen: null
    };
  }

  return {
    wireframeKey: documentContext.wireframeKey,
    activeScreenNode: screenNode,
    activeScreen: {
      screenId: screenRegistration.screenId,
      source: createScreenSource(screenNode)
    }
  };
}
