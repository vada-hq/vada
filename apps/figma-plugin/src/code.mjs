import buttonSchema from "../../../packages/contracts/schemas/button.schema.json";
import inputSchema from "../../../packages/contracts/schemas/input.schema.json";
import selectSchema from "../../../packages/contracts/schemas/select.schema.json";
import { exportFigmaRaw, exportFigmaScreenAssets } from "./figma-raw.mjs";
import { getSelectedNodeInfo } from "./plugin-model.mjs";
import {
  getScreenCandidate,
  getSelectionScope,
  registerActiveScreen,
  restoreScreenContext
} from "./screen-context.mjs";
import {
  prepareImportedScreenSpec,
  restoreScreenSpec,
  saveScreenSpec
} from "./screen-spec.mjs";

const schemaByType = {
  button: buttonSchema,
  input: inputSchema,
  select: selectSchema
};

figma.showUI(__html__, {
  width: 320,
  height: 460,
  themeColors: true
});

let screenContext = {
  wireframeKey: "",
  activeScreenNode: null,
  activeScreen: null
};
const screenContextReady = restoreScreenContext({
  root: figma.root,
  getNodeByIdAsync: (nodeId) => figma.getNodeByIdAsync(nodeId)
}).then((restoredContext) => {
  screenContext = restoredContext;
});

async function publishPluginState() {
  await screenContextReady;

  const selectedNode = figma.currentPage.selection[0] ?? null;
  const selectionScope = getSelectionScope(
    selectedNode,
    screenContext.activeScreenNode
  );

  figma.ui.postMessage({
    type: "plugin-state",
    selectedNode: getSelectedNodeInfo(selectedNode),
    selectionScope,
    wireframeKey: screenContext.wireframeKey,
    activeScreen: screenContext.activeScreen,
    screenSpec: restoreScreenSpec(screenContext.activeScreenNode),
    screenCandidate: getScreenCandidate(selectedNode, selectionScope)
  });
}

figma.on("selectionchange", () => {
  void publishPluginState();
});

async function handleSetActiveScreen(message) {
  try {
    await screenContextReady;

    const selectedNode = figma.currentPage.selection[0] ?? null;

    if (
      !selectedNode ||
      selectedNode.id !== message.nodeId ||
      selectedNode.type !== "FRAME"
    ) {
      throw new Error("선택한 FRAME이 변경되었습니다. 화면을 다시 선택하세요.");
    }

    if (
      screenContext.wireframeKey &&
      screenContext.wireframeKey !== message.wireframeKey?.trim()
    ) {
      throw new Error("이 Figma 파일의 wireframeKey는 변경할 수 없습니다.");
    }

    screenContext = registerActiveScreen({
      root: figma.root,
      screenNode: selectedNode,
      wireframeKey:
        screenContext.wireframeKey || message.wireframeKey,
      screenId: message.screenId
    });

    await publishPluginState();
  } catch (error) {
    figma.ui.postMessage({
      type: "screen-context-error",
      message:
        error instanceof Error
          ? error.message
          : "작업 화면을 저장하지 못했습니다."
    });
  }
}

async function handleSaveScreenSpec(message) {
  try {
    await screenContextReady;

    if (!screenContext.activeScreenNode || !screenContext.activeScreen) {
      throw new Error("먼저 작업 화면을 선택하세요.");
    }

    const screenSpec = await saveScreenSpec({
      screenNode: screenContext.activeScreenNode,
      screenId: screenContext.activeScreen.screenId,
      stateScopeKey: message.stateScopeKey,
      drafts: message.drafts,
      schemaByType,
      getNodeByIdAsync: (nodeId) => figma.getNodeByIdAsync(nodeId)
    });

    figma.ui.postMessage({
      type: "screen-spec-saved",
      wireframeKey: screenContext.wireframeKey,
      screenSpec
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "screen-spec-error",
      message:
        error instanceof Error
          ? error.message
          : "화면 JSON을 저장하지 못했습니다."
    });
  }
}

async function handleExportFigmaRaw() {
  try {
    await screenContextReady;

    if (!screenContext.activeScreenNode || !screenContext.activeScreen) {
      throw new Error("먼저 작업 화면을 선택하세요.");
    }

    const raw = await exportFigmaRaw(screenContext.activeScreenNode);

    let screenAssets = null;
    let assetsError = null;
    try {
      screenAssets = await exportFigmaScreenAssets(
        screenContext.activeScreenNode
      );
    } catch (error) {
      assetsError =
        error instanceof Error
          ? error.message
          : "화면 자산을 추출하지 못했습니다.";
    }

    figma.ui.postMessage({
      type: "figma-raw-exported",
      wireframeKey: screenContext.wireframeKey,
      screenId: screenContext.activeScreen.screenId,
      raw,
      assets: screenAssets?.assets ?? null,
      referencePng: screenAssets?.referencePng ?? null,
      assetsError
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "figma-raw-export-error",
      message:
        error instanceof Error
          ? error.message
          : "Figma 원본 JSON을 추출하지 못했습니다."
    });
  }
}

async function handlePrepareLocalScreenSpec(message) {
  try {
    await screenContextReady;

    if (!screenContext.activeScreenNode || !screenContext.activeScreen) {
      throw new Error("먼저 작업 화면을 선택하세요.");
    }

    const screenSpec = await prepareImportedScreenSpec({
      screenSpec: message.screenSpec,
      screenNode: screenContext.activeScreenNode,
      screenId: screenContext.activeScreen.screenId,
      schemaByType,
      getNodeByIdAsync: (nodeId) => figma.getNodeByIdAsync(nodeId)
    });

    figma.ui.postMessage({
      type: "local-screen-spec-ready",
      revision: message.revision ?? null,
      screenSpec
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "local-screen-spec-error",
      message:
        error instanceof Error
          ? error.message
          : "로컬 화면 JSON을 불러오지 못했습니다."
    });
  }
}

figma.ui.onmessage = async (message) => {
  if (message?.type === "ui-ready") {
    await publishPluginState();
    return;
  }

  if (message?.type === "set-active-screen") {
    await handleSetActiveScreen(message);
    return;
  }

  if (message?.type === "save-screen-spec") {
    await handleSaveScreenSpec(message);
    return;
  }

  if (message?.type === "export-figma-raw") {
    await handleExportFigmaRaw();
    return;
  }

  if (message?.type === "prepare-local-screen-spec") {
    await handlePrepareLocalScreenSpec(message);
  }
};
