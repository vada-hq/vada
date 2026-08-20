// Figma 샌드박스 쪽 진입점. 플러그인은 명세를 쓰지 않는다(2026-08-19 결정).
// 여기서 하는 일은 Figma 안에서만 가능한 두 가지뿐이다:
//   - 화면 신원 등록(wireframeKey/screenId를 Figma 문서 pluginData에 새긴다)
//   - 원본·자산·reference.png 추출
// 화면 명세는 UI가 로컬 브리지에서 직접 읽는다.
import {
  exportFigmaRaw,
  exportFigmaScreenAssets,
  toErrorMessage
} from "./figma-raw.mjs";
import { getSelectedNodeInfo } from "./plugin-model.mjs";
import {
  getScreenCandidate,
  getSelectionScope,
  registerActiveScreen,
  restoreScreenContext
} from "./screen-context.mjs";

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
      message: toErrorMessage(error)
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
    let assetFailures = [];
    try {
      screenAssets = await exportFigmaScreenAssets(
        screenContext.activeScreenNode
      );
      assetFailures = screenAssets.failures;
    } catch (error) {
      // 자산 추출 자체가 통째로 실패한 경우(잘못된 노드 등).
      assetFailures = [toErrorMessage(error)];
    }

    figma.ui.postMessage({
      type: "figma-raw-exported",
      wireframeKey: screenContext.wireframeKey,
      screenId: screenContext.activeScreen.screenId,
      raw,
      assets: screenAssets?.assets ?? null,
      referencePng: screenAssets?.referencePng ?? null,
      assetFailures
    });
  } catch (error) {
    figma.ui.postMessage({
      type: "figma-raw-export-error",
      message: toErrorMessage(error)
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

  if (message?.type === "export-figma-raw") {
    await handleExportFigmaRaw();
  }
};
