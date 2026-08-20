// 플러그인 UI는 명세를 **읽기 전용으로 보여준다**. 편집하지 않는다.
//
// 이유(2026-08-19 결정): 값을 결정하는 일은 AI가 하고 사람은 확인만 한다.
// 편집을 없애면 "명세를 폼으로 펼쳤다가 다시 직렬화하는" 왕복이 사라지고,
// 그 왕복에서만 생기던 결함 계급(편집 위젯 누락·선택+nullable·속성 순서)도
// 함께 사라진다. 로컬 screen.json이 유일한 원본이다.
//
// 플러그인이 여전히 유일하게 할 수 있는 일만 남긴다:
//   - Figma 원본·자산·reference.png 추출 (Figma 안에서만 가능)
//   - 화면 신원 등록 (wireframeKey/screenId를 Figma 문서에 새긴다)
import { schemaByType } from "./element-schemas.mjs";
import { toErrorMessage } from "./figma-raw.mjs";
import { getRequiredFieldCandidates } from "../../../packages/contracts/src/button-execution.mjs";
import { getElementTypeOptions, getSchemaPropertyKeys } from "./plugin-model.mjs";
import {
  loadOptionSourcesFromLocal,
  loadScreenSpecFromLocal,
  loadStateScopesFromLocal,
  saveFigmaAssetToLocal,
  saveFigmaRawToLocal,
  saveFigmaReferenceToLocal
} from "./local-bridge.mjs";
import {
  findOptionSourceByKey,
  normalizeOptionSourceCatalog
} from "./option-sources.mjs";
import {
  findStateScopeByKey,
  normalizeStateScopeCatalog
} from "./state-scopes.mjs";

const selectionDetails = document.querySelector("#selection-details");
const emptyState = document.querySelector("#empty-state");
const nodeId = document.querySelector("#node-id");
const nodeName = document.querySelector("#node-name");
const nodeType = document.querySelector("#node-type");
const currentScreenEmpty = document.querySelector("#current-screen-empty");
const currentScreenSummary = document.querySelector("#current-screen-summary");
const currentScreenId = document.querySelector("#current-screen-id");
const currentScreenName = document.querySelector("#current-screen-name");
const currentWireframeKey = document.querySelector("#current-wireframe-key");
const stateScopeSummary = document.querySelector("#state-scope-summary");
const stateScopeKey = document.querySelector("#state-scope-key");
const stateScopeRetention = document.querySelector("#state-scope-retention");
const stateScopeClearOn = document.querySelector("#state-scope-clear-on");
const stateScopeStatus = document.querySelector("#state-scope-status");
const saveFigmaRaw = document.querySelector("#save-figma-raw");
const refreshScreenSpec = document.querySelector("#refresh-screen-spec");
const screenSaveStatus = document.querySelector("#screen-save-status");
const screenSelectionSection = document.querySelector(
  "#screen-selection-section"
);
const screenSelectionTitle = document.querySelector("#screen-selection-title");
const screenSelectionDescription = document.querySelector(
  "#screen-selection-description"
);
const wireframeKeyInput = document.querySelector("#wireframe-key-input");
const screenIdInput = document.querySelector("#screen-id-input");
const setActiveScreen = document.querySelector("#set-active-screen");
const screenContextError = document.querySelector("#screen-context-error");
const selectionNotice = document.querySelector("#selection-notice");
const screenSpecSection = document.querySelector("#screen-spec-section");
const screenSpecStatus = document.querySelector("#screen-spec-status");
const screenSpecElements = document.querySelector("#screen-spec-elements");

const typeLabelByValue = new Map(
  getElementTypeOptions().map((option) => [option.value, option.label])
);

let currentSelection = null;
let currentActiveScreen = null;
let activeWireframeKey = "";
let loadedScreenNodeId;
let currentScreenSpec = null;
let specRequestVersion = 0;
let lastSelectionScope = null;
let lastHadScreenCandidate = false;
let optionSourceCatalog = { schemaVersion: 2, sources: [] };
let optionSourceCatalogError = "";
let optionSourceRequestVersion = 0;
let stateScopeCatalog = { schemaVersion: 1, scopes: [] };
let stateScopeCatalogError = "";
let stateScopeRequestVersion = 0;

const FLOW_STATE_RETENTION_LABEL = "같은 스코프 화면 간 이동 시 값 유지·복원";
const FLOW_STATE_DEFAULT_CLEAR_LABEL = "완료·취소 시 제거";

function formatStateScopeClearOn(clearOn) {
  if (clearOn.includes("complete") && clearOn.includes("cancel")) {
    return FLOW_STATE_DEFAULT_CLEAR_LABEL;
  }

  const labels = { complete: "완료", cancel: "취소" };
  return `${clearOn.map((event) => labels[event] ?? event).join("·")} 시 제거`;
}

function renderCurrentStateScope() {
  const scopeKey = currentScreenSpec?.stateScopeKey ?? "";

  if (!currentActiveScreen) {
    stateScopeSummary.hidden = true;
    return;
  }

  stateScopeSummary.hidden = false;
  stateScopeKey.textContent = scopeKey || "미지정";
  delete stateScopeStatus.dataset.tone;

  if (!scopeKey) {
    stateScopeRetention.textContent = "화면 간 값 유지 계약 없음";
    stateScopeClearOn.textContent = "제거 시점 미지정";
    stateScopeStatus.textContent = "이 화면은 상태 스코프를 참조하지 않습니다.";
    return;
  }

  if (stateScopeCatalogError) {
    stateScopeRetention.textContent = "카탈로그 확인 필요";
    stateScopeClearOn.textContent = "카탈로그 확인 필요";
    stateScopeStatus.textContent = stateScopeCatalogError;
    stateScopeStatus.dataset.tone = "error";
    return;
  }

  const scope = findStateScopeByKey(stateScopeCatalog, scopeKey);

  if (!scope) {
    stateScopeRetention.textContent = "정의되지 않은 스코프";
    stateScopeClearOn.textContent = "정의되지 않은 스코프";
    stateScopeStatus.textContent = `상태 스코프 ${scopeKey}를 카탈로그에서 찾을 수 없습니다.`;
    stateScopeStatus.dataset.tone = "error";
    return;
  }

  stateScopeRetention.textContent = FLOW_STATE_RETENTION_LABEL;
  stateScopeClearOn.textContent = formatStateScopeClearOn(scope.clearOn);
  stateScopeStatus.textContent = scope.description;
}

function setScreenContextBusy(isBusy) {
  setActiveScreen.disabled = isBusy;
  setActiveScreen.textContent = isBusy
    ? "설정 중…"
    : setActiveScreen.dataset.defaultLabel ?? "이 화면에서 작업하기";
}

function hideScreenContextError() {
  screenContextError.hidden = true;
  screenContextError.textContent = "";
}

function showScreenContextError(message) {
  screenContextError.textContent = message;
  screenContextError.hidden = false;
  setScreenContextBusy(false);
}

function setFigmaRawSaveBusy(isBusy) {
  saveFigmaRaw.disabled = isBusy;
  saveFigmaRaw.textContent = isBusy
    ? "원본 추출·저장 중…"
    : "Figma 원본 JSON 저장";
}

function setSpecLoadBusy(isBusy) {
  refreshScreenSpec.disabled = isBusy;
  refreshScreenSpec.textContent = isBusy ? "불러오는 중…" : "명세 새로고침";
}

function clearScreenSaveStatus() {
  screenSaveStatus.hidden = true;
  screenSaveStatus.textContent = "";
  delete screenSaveStatus.dataset.tone;
}

function showScreenSaveStatus(message, tone = "success") {
  screenSaveStatus.textContent = message;
  screenSaveStatus.dataset.tone = tone;
  screenSaveStatus.hidden = false;
}

function showSpecStatus(message, tone) {
  screenSpecStatus.textContent = message;
  if (tone) {
    screenSpecStatus.dataset.tone = tone;
  } else {
    delete screenSpecStatus.dataset.tone;
  }
}

function renderCurrentScreen(activeScreen, wireframeKey) {
  if (!activeScreen) {
    currentScreenEmpty.hidden = false;
    currentScreenSummary.hidden = true;
    currentScreenId.textContent = "";
    currentScreenName.textContent = "";
    currentWireframeKey.textContent = wireframeKey
      ? `wireframeKey: ${wireframeKey}`
      : "";
    saveFigmaRaw.hidden = true;
    refreshScreenSpec.hidden = true;
    renderCurrentStateScope();
    return;
  }

  currentScreenEmpty.hidden = true;
  currentScreenSummary.hidden = false;
  currentScreenId.textContent = activeScreen.screenId;
  currentScreenName.textContent = activeScreen.source.nodeName;
  currentWireframeKey.textContent = `wireframeKey: ${wireframeKey}`;
  saveFigmaRaw.hidden = false;
  refreshScreenSpec.hidden = false;
  setFigmaRawSaveBusy(false);
  setSpecLoadBusy(false);
  renderCurrentStateScope();
}

function renderScreenCandidate(screenCandidate, wireframeKey, activeScreen) {
  if (!screenCandidate) {
    screenSelectionSection.hidden = true;
    setActiveScreen.dataset.nodeId = "";
    return;
  }

  const isChangingScreen = Boolean(activeScreen);
  const defaultLabel = isChangingScreen
    ? "이 화면으로 변경"
    : "이 화면에서 작업하기";

  screenSelectionSection.hidden = false;
  screenSelectionTitle.textContent = isChangingScreen
    ? "작업 화면 변경"
    : "작업 화면 선택";
  screenSelectionDescription.textContent = screenCandidate.source.nodeName;
  wireframeKeyInput.value = wireframeKey;
  wireframeKeyInput.readOnly = Boolean(wireframeKey);
  screenIdInput.value = screenCandidate.suggestedScreenId;
  setActiveScreen.dataset.nodeId = screenCandidate.source.nodeId;
  setActiveScreen.dataset.defaultLabel = defaultLabel;
  setActiveScreen.textContent = defaultLabel;
  setScreenContextBusy(false);
  hideScreenContextError();
}

function renderSelectionNotice(selectionScope, hasScreenCandidate) {
  let message = "";

  if (selectionScope === "screen") {
    message = "현재 작업 화면입니다. 아래에서 등록된 요소를 확인하세요.";
  } else if (selectionScope === "outside") {
    message = hasScreenCandidate
      ? "현재 작업 화면 밖의 FRAME입니다. 변경 버튼을 눌러야 작업 화면이 바뀝니다."
      : "현재 작업 화면 밖의 요소입니다.";
  } else if (selectionScope === "no-active-screen" && !hasScreenCandidate) {
    message = "먼저 작업할 화면 FRAME을 선택하세요.";
  } else if (selectionScope === "inside" && currentScreenSpec) {
    // 명세를 아직 못 읽었으면 아무 말도 하지 않는다. 로딩 중을 "미등록"으로
    // 보고하면 사실이 아닌 것을 사실처럼 말하게 된다.
    message = findElementByNodeId(currentSelection?.nodeId)
      ? ""
      : "이 노드는 명세에 등록되어 있지 않습니다.";
  }

  selectionNotice.textContent = message;
  selectionNotice.hidden = !message;
}

function findElementByNodeId(candidateNodeId) {
  if (!candidateNodeId || !Array.isArray(currentScreenSpec?.elements)) {
    return null;
  }

  return (
    currentScreenSpec.elements.find(
      (element) => element?.source?.nodeId === candidateNodeId
    ) ?? null
  );
}

// 값이 없는 속성도 이름은 보여준다. "무엇을 결정해야 하는지"를 빠짐없이
// 드러내는 것이 스키마를 UI로 쓰는 목적이고, 그건 편집이 없어도 유효하다.
function createPropertyRow(label, value, options = {}) {
  const row = document.createElement("div");
  if (options.nested) {
    row.className = "spec-nested";
  }

  const name = document.createElement("dt");
  const nameCode = document.createElement("code");
  nameCode.textContent = label;
  name.append(nameCode);

  const detail = document.createElement("dd");
  if (value === undefined) {
    detail.className = "spec-value-absent";
    detail.textContent = "없음";
  } else if (value === null) {
    detail.className = "spec-value-absent";
    detail.textContent = "null";
  } else if (typeof value === "object") {
    detail.textContent = JSON.stringify(value);
  } else {
    detail.textContent = String(value);
  }

  row.append(name, detail);
  return row;
}

function appendSpecProperties(list, schema, spec, nested = false) {
  for (const propertyKey of getSchemaPropertyKeys(schema)) {
    const property = schema.properties[propertyKey];
    const value = spec?.[propertyKey];

    if (
      property.type === "object" &&
      property.properties &&
      typeof property.properties === "object"
    ) {
      list.append(
        createPropertyRow(
          propertyKey,
          value === undefined ? undefined : "",
          { nested }
        )
      );
      if (value !== undefined) {
        appendSpecProperties(list, property, value, true);
      }
      continue;
    }

    list.append(createPropertyRow(propertyKey, value, { nested }));
  }
}

// 선택지 출처는 카탈로그가 원본이라 화면 JSON만 봐서는 내용을 알 수 없다.
// 확인이 목적이므로 참조가 실제로 닿는지까지 보여준다.
function createOptionSourceRow(spec) {
  const key = spec?.optionsSource?.key;

  if (typeof key !== "string" || !key) {
    return null;
  }

  if (optionSourceCatalogError) {
    return createPropertyRow("↳ 선택지 출처", optionSourceCatalogError, {
      nested: true
    });
  }

  const source = findOptionSourceByKey(optionSourceCatalog, key);

  if (!source) {
    return createPropertyRow(
      "↳ 선택지 출처",
      `카탈로그에 '${key}'가 없습니다`,
      { nested: true }
    );
  }

  const summary =
    source.type === "static"
      ? `static · 선택지 ${source.options?.length ?? 0}개`
      : `remote · ${source.request?.method ?? "GET"} ${source.request?.path ?? ""}`;

  return createPropertyRow("↳ 선택지 출처", summary, { nested: true });
}

// 버튼의 실행 조건은 "필수 필드가 모두 채워졌는가"라는 규칙 이름일 뿐이라,
// 실제로 어느 필드가 판정 후보인지는 화면 전체를 봐야 안다. 확인이 목적이므로
// 그 계산을 대신 해서 보여준다.
function createButtonExecutionRows(spec) {
  const rows = [];

  if (spec.action?.executeWhen === undefined) {
    rows.push(
      createPropertyRow("↳ 실행 판정", "실행 조건 없이 항상 실행", {
        nested: true
      })
    );
    return rows;
  }

  const candidates = getRequiredFieldCandidates(
    Array.isArray(currentScreenSpec?.elements) ? currentScreenSpec.elements : []
  );

  rows.push(
    createPropertyRow(
      "↳ 판정 후보",
      candidates.length > 0
        ? candidates.map((candidate) => candidate.fieldKey).join(", ")
        : "이 화면에 필수 필드가 없습니다",
      { nested: true }
    )
  );
  rows.push(
    createPropertyRow(
      "↳ 판정 방식",
      "enabledWhen을 만족한 후보만 판정하고, 막히면 첫 누락 필드로 이동",
      { nested: true }
    )
  );
  return rows;
}

function createSpecElementItem(element, index) {
  const spec = element?.spec ?? {};
  const schema = schemaByType[spec.type];
  const item = document.createElement("li");
  item.className = "spec-element";
  item.dataset.nodeId = element?.source?.nodeId ?? "";
  item.dataset.selected = String(
    Boolean(currentSelection) && element?.source?.nodeId === currentSelection.nodeId
  );

  const heading = document.createElement("div");
  heading.className = "spec-element-heading";

  const indexLabel = document.createElement("span");
  indexLabel.className = "spec-element-index";
  indexLabel.textContent = `${index}`;

  const typeLabel = document.createElement("span");
  typeLabel.className = "spec-element-type";
  typeLabel.textContent = typeLabelByValue.get(spec.type) ?? spec.type ?? "?";

  const identity = document.createElement("span");
  identity.className = "spec-element-identity";
  identity.textContent =
    spec.type === "group" ? spec.title ?? "" : spec.label ?? spec.fieldKey ?? "";

  const node = document.createElement("code");
  node.className = "spec-element-node";
  node.textContent = element?.source?.nodeId ?? "";

  heading.append(indexLabel, typeLabel, identity, node);
  item.append(heading);

  if (!schema) {
    item.append(
      createPropertyRow("type", `알 수 없는 유형: ${spec.type}`)
    );
    return item;
  }

  const properties = document.createElement("dl");
  properties.className = "spec-properties";
  appendSpecProperties(properties, schema, spec);

  const optionSourceRow = createOptionSourceRow(spec);
  if (optionSourceRow) {
    properties.append(optionSourceRow);
  }

  if (spec.type === "button") {
    properties.append(...createButtonExecutionRows(spec));
  }

  item.append(properties);
  return item;
}

function renderScreenSpec() {
  if (!currentActiveScreen) {
    screenSpecSection.hidden = true;
    return;
  }

  screenSpecSection.hidden = false;

  if (!currentScreenSpec) {
    screenSpecElements.replaceChildren();
    return;
  }

  const elements = Array.isArray(currentScreenSpec.elements)
    ? currentScreenSpec.elements
    : [];

  screenSpecElements.replaceChildren(
    ...elements.map((element, index) => createSpecElementItem(element, index))
  );
}

function renderSelection(node) {
  currentSelection = node;
  nodeId.textContent = node.nodeId;
  nodeName.textContent = node.name;
  nodeType.textContent = node.type;
  selectionDetails.hidden = false;
  emptyState.hidden = true;
  renderScreenSpec();
}

function renderEmptyState() {
  currentSelection = null;
  selectionDetails.hidden = true;
  emptyState.hidden = false;
  renderScreenSpec();
}

async function loadCurrentScreenSpec({ showStatus = false } = {}) {
  const activeScreen = currentActiveScreen;
  const wireframeKey = activeWireframeKey;

  if (!activeScreen || !wireframeKey) {
    return;
  }

  const requestVersion = ++specRequestVersion;
  setSpecLoadBusy(true);

  try {
    const result = await loadScreenSpecFromLocal({
      wireframeKey,
      screenId: activeScreen.screenId
    });

    if (
      requestVersion !== specRequestVersion ||
      activeScreen.source.nodeId !== currentActiveScreen?.source?.nodeId
    ) {
      return;
    }

    if (result.status === "missing") {
      currentScreenSpec = null;
      showSpecStatus(
        `${activeScreen.screenId}/screen.json이 아직 없습니다. AI가 명세를 작성하면 여기에 표시됩니다.`
      );
    } else {
      currentScreenSpec = result.screenSpec;
      const count = Array.isArray(result.screenSpec?.elements)
        ? result.screenSpec.elements.length
        : 0;
      showSpecStatus(
        showStatus
          ? `${activeScreen.screenId}/screen.json에서 요소 ${count}개를 읽었습니다.`
          : `요소 ${count}개`
      );
    }
  } catch (error) {
    if (requestVersion !== specRequestVersion) {
      return;
    }
    currentScreenSpec = null;
    showSpecStatus(
      toErrorMessage(error),
      "error"
    );
  } finally {
    if (requestVersion === specRequestVersion) {
      setSpecLoadBusy(false);
      renderCurrentStateScope();
      renderScreenSpec();
      renderSelectionNotice(lastSelectionScope, lastHadScreenCandidate);
    }
  }
}

async function loadCurrentOptionSources() {
  const wireframeKey = activeWireframeKey;

  if (!wireframeKey) {
    optionSourceCatalog = { schemaVersion: 2, sources: [] };
    optionSourceCatalogError = "";
    return;
  }

  const requestVersion = ++optionSourceRequestVersion;

  try {
    const catalog = normalizeOptionSourceCatalog(
      await loadOptionSourcesFromLocal({ wireframeKey })
    );

    if (requestVersion !== optionSourceRequestVersion) {
      return;
    }

    optionSourceCatalog = catalog;
    optionSourceCatalogError = "";
  } catch (error) {
    if (requestVersion !== optionSourceRequestVersion) {
      return;
    }

    optionSourceCatalog = { schemaVersion: 2, sources: [] };
    optionSourceCatalogError =
      toErrorMessage(error);
  } finally {
    if (requestVersion === optionSourceRequestVersion) {
      renderScreenSpec();
    }
  }
}

async function loadCurrentStateScopes() {
  const wireframeKey = activeWireframeKey;

  if (!wireframeKey) {
    stateScopeCatalog = { schemaVersion: 1, scopes: [] };
    stateScopeCatalogError = "";
    return;
  }

  const requestVersion = ++stateScopeRequestVersion;

  try {
    const catalog = normalizeStateScopeCatalog(
      await loadStateScopesFromLocal({ wireframeKey })
    );

    if (requestVersion !== stateScopeRequestVersion) {
      return;
    }

    stateScopeCatalog = catalog;
    stateScopeCatalogError = "";
  } catch (error) {
    if (requestVersion !== stateScopeRequestVersion) {
      return;
    }

    stateScopeCatalog = { schemaVersion: 1, scopes: [] };
    stateScopeCatalogError =
      toErrorMessage(error);
  } finally {
    if (requestVersion === stateScopeRequestVersion) {
      renderCurrentStateScope();
    }
  }
}

setActiveScreen.addEventListener("click", () => {
  const selectedNodeId = setActiveScreen.dataset.nodeId;
  const wireframeKey = wireframeKeyInput.value.trim();
  const screenId = screenIdInput.value.trim();

  hideScreenContextError();

  if (!wireframeKey) {
    showScreenContextError("wireframeKey를 입력하세요.");
    wireframeKeyInput.focus();
    return;
  }

  if (!screenId) {
    showScreenContextError("screenId를 입력하세요.");
    screenIdInput.focus();
    return;
  }

  setScreenContextBusy(true);
  parent.postMessage(
    {
      pluginMessage: {
        type: "set-active-screen",
        nodeId: selectedNodeId,
        wireframeKey,
        screenId
      }
    },
    "*"
  );
});

saveFigmaRaw.addEventListener("click", () => {
  clearScreenSaveStatus();
  setFigmaRawSaveBusy(true);

  parent.postMessage({ pluginMessage: { type: "export-figma-raw" } }, "*");
});

refreshScreenSpec.addEventListener("click", async () => {
  clearScreenSaveStatus();
  await Promise.all([loadCurrentOptionSources(), loadCurrentStateScopes()]);
  await loadCurrentScreenSpec({ showStatus: true });
});

window.onmessage = async (event) => {
  const message = event.data.pluginMessage;

  if (message?.type === "screen-context-error") {
    showScreenContextError(message.message);
    return;
  }

  if (message?.type === "figma-raw-export-error") {
    setFigmaRawSaveBusy(false);
    showScreenSaveStatus(message.message, "error");
    return;
  }

  if (message?.type === "figma-raw-exported") {
    try {
      await saveFigmaRawToLocal({
        wireframeKey: message.wireframeKey,
        screenId: message.screenId,
        raw: message.raw
      });

      const savedArtifacts = [`${message.screenId}/figma.raw.json`];
      const failures = [];

      if (Array.isArray(message.assetFailures)) {
        failures.push(...message.assetFailures);
      }

      if (Array.isArray(message.assets) && message.assets.length > 0) {
        let savedAssetCount = 0;
        for (const asset of message.assets) {
          try {
            await saveFigmaAssetToLocal({
              wireframeKey: message.wireframeKey,
              screenId: message.screenId,
              fileName: asset.fileName,
              svg: asset.svg
            });
            savedAssetCount += 1;
          } catch (error) {
            failures.push(
              `${asset.fileName}: ${
                toErrorMessage(error)
              }`
            );
          }
        }
        if (savedAssetCount > 0) {
          savedArtifacts.push(`벡터 SVG ${savedAssetCount}개`);
        }
      }

      if (message.referencePng instanceof Uint8Array) {
        try {
          await saveFigmaReferenceToLocal({
            wireframeKey: message.wireframeKey,
            screenId: message.screenId,
            png: message.referencePng
          });
          savedArtifacts.push("reference.png");
        } catch (error) {
          failures.push(
            toErrorMessage(error)
          );
        }
      }

      if (failures.length > 0) {
        showScreenSaveStatus(
          `${savedArtifacts.join(", ")}은 저장했지만 일부 자산이 실패했습니다. ${
            failures[0]
          }${failures.length > 1 ? ` 외 ${failures.length - 1}건` : ""}`,
          "error"
        );
      } else {
        showScreenSaveStatus(
          `${savedArtifacts.join(", ")}을 로컬 작업 폴더에 저장했습니다.`
        );
      }
    } catch (error) {
      showScreenSaveStatus(
        toErrorMessage(error),
        "error"
      );
    } finally {
      setFigmaRawSaveBusy(false);
    }
    return;
  }

  if (message?.type !== "plugin-state") {
    return;
  }

  const nextScreenNodeId = message.activeScreen?.source?.nodeId ?? null;
  const screenChanged = nextScreenNodeId !== loadedScreenNodeId;

  if (screenChanged) {
    loadedScreenNodeId = nextScreenNodeId;
    currentScreenSpec = null;
    clearScreenSaveStatus();
    showSpecStatus("");
  }

  currentActiveScreen = message.activeScreen;
  activeWireframeKey = message.wireframeKey;

  renderCurrentScreen(message.activeScreen, message.wireframeKey);
  renderScreenCandidate(
    message.screenCandidate,
    message.wireframeKey,
    message.activeScreen
  );

  if (message.selectedNode) {
    renderSelection(message.selectedNode);
  } else {
    renderEmptyState();
  }

  lastSelectionScope = message.selectionScope;
  lastHadScreenCandidate = Boolean(message.screenCandidate);
  renderSelectionNotice(lastSelectionScope, lastHadScreenCandidate);

  if (screenChanged && message.activeScreen) {
    await Promise.all([loadCurrentOptionSources(), loadCurrentStateScopes()]);
    void loadCurrentScreenSpec();
  }
};

parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
