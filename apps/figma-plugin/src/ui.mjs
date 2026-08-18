import { schemaByType } from "./element-schemas.mjs";
import { getRequiredFieldCandidates } from "../../../packages/contracts/src/button-execution.mjs";
import {
  createNodeDraftStore,
  getElementTypeOptions,
  getSchemaConstantValue,
  getSchemaEnumValues,
  getSchemaPropertyEditorKind,
  getSchemaPropertyKeys,
  getSchemaPropertyKeysForElementType
} from "./plugin-model.mjs";
import {
  loadOptionSourcesFromLocal,
  loadScreenSpecFromLocal,
  loadStateScopesFromLocal,
  saveFigmaAssetToLocal,
  saveFigmaRawToLocal,
  saveFigmaReferenceToLocal,
  saveScreenSpecToLocal
} from "./local-bridge.mjs";
import {
  filterOptionSourceOptions,
  findOptionSourceByKey,
  getOptionSourceReadiness,
  normalizeOptionSourceCatalog
} from "./option-sources.mjs";
import {
  createDraftsFromScreenSpec,
  getScreenSpecFileName
} from "./screen-spec.mjs";
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
const currentScreenSummary = document.querySelector(
  "#current-screen-summary"
);
const currentScreenId = document.querySelector("#current-screen-id");
const currentScreenName = document.querySelector("#current-screen-name");
const currentWireframeKey = document.querySelector(
  "#current-wireframe-key"
);
const stateScopeSummary = document.querySelector("#state-scope-summary");
const stateScopeKey = document.querySelector("#state-scope-key");
const stateScopeRetention = document.querySelector(
  "#state-scope-retention"
);
const stateScopeClearOn = document.querySelector("#state-scope-clear-on");
const stateScopeStatus = document.querySelector("#state-scope-status");
const saveScreen = document.querySelector("#save-screen");
const saveFigmaRaw = document.querySelector("#save-figma-raw");
const loadLocalScreen = document.querySelector("#load-local-screen");
const screenSaveStatus = document.querySelector("#screen-save-status");
const screenSelectionSection = document.querySelector(
  "#screen-selection-section"
);
const screenSelectionTitle = document.querySelector(
  "#screen-selection-title"
);
const screenSelectionDescription = document.querySelector(
  "#screen-selection-description"
);
const wireframeKeyInput = document.querySelector("#wireframe-key-input");
const screenIdInput = document.querySelector("#screen-id-input");
const setActiveScreen = document.querySelector("#set-active-screen");
const screenContextError = document.querySelector("#screen-context-error");
const selectionNotice = document.querySelector("#selection-notice");
const elementTypeSection = document.querySelector("#element-type-section");
const elementTypeOptions = document.querySelector("#element-type-options");
const selectedElementType = document.querySelector("#selected-element-type");
const registrationControls = document.querySelector("#registration-controls");
const cancelRegistration = document.querySelector("#cancel-registration");
const cancelRegistrationConfirmation = document.querySelector(
  "#cancel-registration-confirmation"
);
const keepRegistration = document.querySelector("#keep-registration");
const confirmCancelRegistration = document.querySelector(
  "#confirm-cancel-registration"
);
const schemaKeysSection = document.querySelector("#schema-keys-section");
const schemaKeys = document.querySelector("#schema-keys");

const typeOptions = getElementTypeOptions();
const STATIC_OPTION_SEARCH_THRESHOLD = 20;
const nodeDraftStore = createNodeDraftStore();
let currentSelection = null;
let currentElementType = null;
let currentSelectionCanEdit = false;
let loadedScreenNodeId;
let currentActiveScreen = null;
let activeWireframeKey = "";
let currentPersistedScreenSpec = null;
let localRevision;
let hasUnloadedLocalChanges = false;
let localRequestVersion = 0;
let optionSourceCatalog = { schemaVersion: 2, sources: [] };
let optionSourceCatalogError = "";
let optionSourceRequestVersion = 0;
let currentScreenStateScopeKey = "";
// 화면 meta(제목·부제·안내문)는 UI에서 편집하지 않지만 저장 왕복에서 보존한다.
let currentScreenMeta = null;
let stateScopeCatalog = { schemaVersion: 1, scopes: [] };
let stateScopeCatalogError = "";
let stateScopeRequestVersion = 0;

const FLOW_STATE_RETENTION_LABEL =
  "같은 스코프 화면 간 이동 시 값 유지·복원";
const FLOW_STATE_DEFAULT_CLEAR_LABEL = "완료·취소 시 제거";

function formatStateScopeClearOn(clearOn) {
  if (clearOn.includes("complete") && clearOn.includes("cancel")) {
    return FLOW_STATE_DEFAULT_CLEAR_LABEL;
  }

  const labels = { complete: "완료", cancel: "취소" };
  return `${clearOn.map((event) => labels[event] ?? event).join("·")} 시 제거`;
}

function renderCurrentStateScope() {
  if (!currentActiveScreen) {
    stateScopeSummary.hidden = true;
    return;
  }

  stateScopeSummary.hidden = false;
  stateScopeKey.textContent = currentScreenStateScopeKey || "미지정";
  delete stateScopeStatus.dataset.tone;

  if (!currentScreenStateScopeKey) {
    stateScopeRetention.textContent = "화면 간 값 유지 계약 없음";
    stateScopeClearOn.textContent = "제거 시점 미지정";
    stateScopeStatus.textContent =
      "이 화면은 상태 스코프를 참조하지 않습니다.";
    return;
  }

  if (stateScopeCatalogError) {
    stateScopeRetention.textContent = "카탈로그 확인 필요";
    stateScopeClearOn.textContent = "카탈로그 확인 필요";
    stateScopeStatus.textContent = stateScopeCatalogError;
    stateScopeStatus.dataset.tone = "error";
    return;
  }

  const scope = findStateScopeByKey(
    stateScopeCatalog,
    currentScreenStateScopeKey
  );

  if (!scope) {
    stateScopeRetention.textContent = "정의되지 않은 스코프";
    stateScopeClearOn.textContent = "정의되지 않은 스코프";
    stateScopeStatus.textContent =
      `상태 스코프 ${currentScreenStateScopeKey}를 카탈로그에서 찾을 수 없습니다.`;
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

function setScreenSaveBusy(isBusy) {
  saveScreen.disabled = isBusy;
  saveScreen.textContent = isBusy ? "저장 중…" : "이 화면 저장";
}

function setFigmaRawSaveBusy(isBusy) {
  saveFigmaRaw.disabled = isBusy;
  saveFigmaRaw.textContent = isBusy
    ? "원본 추출·저장 중…"
    : "Figma 원본 JSON 저장";
}

function setLocalLoadBusy(isBusy) {
  loadLocalScreen.disabled = isBusy;
  loadLocalScreen.textContent = isBusy
    ? "로컬 확인 중…"
    : hasUnloadedLocalChanges
      ? "로컬 초안 변경됨 · 불러오기"
      : "로컬 초안 불러오기";
}

function setLocalChangedState(hasChanges) {
  hasUnloadedLocalChanges = hasChanges;
  loadLocalScreen.dataset.changed = String(hasChanges);
  setLocalLoadBusy(false);
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

function renderCurrentScreen(activeScreen, wireframeKey) {
  if (!activeScreen) {
    currentScreenEmpty.hidden = false;
    currentScreenSummary.hidden = true;
    currentScreenId.textContent = "";
    currentScreenName.textContent = "";
    currentWireframeKey.textContent = wireframeKey
      ? `wireframeKey: ${wireframeKey}`
      : "";
    saveScreen.hidden = true;
    saveFigmaRaw.hidden = true;
    loadLocalScreen.hidden = true;
    renderCurrentStateScope();
    return;
  }

  currentScreenEmpty.hidden = true;
  currentScreenSummary.hidden = false;
  currentScreenId.textContent = activeScreen.screenId;
  currentScreenName.textContent = activeScreen.source.nodeName;
  currentWireframeKey.textContent = `wireframeKey: ${wireframeKey}`;
  saveScreen.hidden = false;
  saveFigmaRaw.hidden = false;
  loadLocalScreen.hidden = false;
  setScreenSaveBusy(false);
  setFigmaRawSaveBusy(false);
  setLocalLoadBusy(false);
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
  screenSelectionDescription.textContent =
    screenCandidate.source.nodeName;
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
    message = "현재 작업 화면입니다. 등록할 내부 요소를 선택하세요.";
  } else if (selectionScope === "outside") {
    message = hasScreenCandidate
      ? "현재 작업 화면 밖의 FRAME입니다. 변경 버튼을 눌러야 작업 화면이 바뀝니다."
      : "현재 작업 화면 밖의 요소는 등록할 수 없습니다.";
  } else if (
    selectionScope === "no-active-screen" &&
    !hasScreenCandidate
  ) {
    message = "먼저 작업할 화면 FRAME을 선택하세요.";
  }

  selectionNotice.textContent = message;
  selectionNotice.hidden = !message;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function collectCurrentSchemaValues() {
  return Object.fromEntries(
    [...schemaKeys.querySelectorAll("[name]")].map((control) => [
      control.name,
      control.value
    ])
  );
}

function saveCurrentDraft() {
  if (!currentSelection?.nodeId || !currentElementType) {
    return;
  }

  nodeDraftStore.save(currentSelection.nodeId, {
    elementType: currentElementType,
    values: collectCurrentSchemaValues()
  });
}

function syncScreenDrafts(activeScreen, screenSpec) {
  const nextScreenNodeId = activeScreen?.source?.nodeId ?? null;

  if (nextScreenNodeId === loadedScreenNodeId) {
    return false;
  }

  saveCurrentDraft();
  nodeDraftStore.clear();
  currentSelection = null;
  currentElementType = null;
  loadedScreenNodeId = nextScreenNodeId;
  localRevision = undefined;
  setLocalChangedState(false);
  clearScreenSaveStatus();

  for (const draft of createDraftsFromScreenSpec(
    screenSpec,
    schemaByType
  )) {
    nodeDraftStore.save(draft.nodeId, draft);
  }

  return true;
}

function replaceScreenDrafts(screenSpec) {
  const selectedNode = currentSelection;
  const canEditElement = currentSelectionCanEdit;

  nodeDraftStore.clear();
  for (const draft of createDraftsFromScreenSpec(
    screenSpec,
    schemaByType
  )) {
    nodeDraftStore.save(draft.nodeId, draft);
  }

  currentElementType = null;
  if (selectedNode) {
    renderSelection(selectedNode, canEditElement);
  }
}

function areScreenSpecsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function checkLocalScreenSpec({ showUnchanged = false } = {}) {
  const activeScreen = currentActiveScreen;
  const wireframeKey = activeWireframeKey;

  if (!activeScreen || !wireframeKey) {
    return null;
  }

  const requestVersion = ++localRequestVersion;
  setLocalLoadBusy(true);
  saveScreen.disabled = true;

  try {
    const result = await loadScreenSpecFromLocal({
      wireframeKey,
      screenId: activeScreen.screenId
    });

    if (
      requestVersion !== localRequestVersion ||
      activeScreen.source.nodeId !== currentActiveScreen?.source?.nodeId
    ) {
      return null;
    }

    localRevision = result.revision;

    if (result.status === "missing") {
      setLocalChangedState(false);
      if (showUnchanged) {
        showScreenSaveStatus(
          "저장된 로컬 초안이 없습니다. 먼저 이 화면을 저장하세요.",
          "error"
        );
      }
      return result;
    }

    const hasChanges = !areScreenSpecsEqual(
      result.screenSpec,
      currentPersistedScreenSpec
    );
    setLocalChangedState(hasChanges);

    if (hasChanges) {
      showScreenSaveStatus(
        "로컬 초안이 변경되었습니다. 불러와 검토하세요."
      );
    } else if (showUnchanged) {
      showScreenSaveStatus("로컬 초안과 현재 내용이 같습니다.");
    }

    return result;
  } catch (error) {
    if (requestVersion !== localRequestVersion) {
      return null;
    }

    const detail =
      error instanceof Error
        ? error.message
        : "로컬 화면 JSON을 확인하지 못했습니다.";
    showScreenSaveStatus(detail, "error");
    return null;
  } finally {
    if (requestVersion === localRequestVersion) {
      setLocalLoadBusy(false);
      saveScreen.disabled = false;
    }
  }
}

function rerenderCurrentSelectDraft() {
  if (currentSelection && currentElementType === "select") {
    const values = collectCurrentSchemaValues();
    renderSchemaKeys("select", values);
    saveCurrentDraft();
  }
}

async function loadCurrentOptionSources({ showError = false } = {}) {
  const wireframeKey = activeWireframeKey;

  if (!wireframeKey) {
    optionSourceCatalog = { schemaVersion: 2, sources: [] };
    optionSourceCatalogError = "";
    return null;
  }

  const requestVersion = ++optionSourceRequestVersion;

  try {
    const catalog = normalizeOptionSourceCatalog(
      await loadOptionSourcesFromLocal({ wireframeKey })
    );

    if (
      requestVersion !== optionSourceRequestVersion ||
      wireframeKey !== activeWireframeKey
    ) {
      return null;
    }

    optionSourceCatalog = catalog;
    optionSourceCatalogError = "";
    rerenderCurrentSelectDraft();
    return catalog;
  } catch (error) {
    if (requestVersion !== optionSourceRequestVersion) {
      return null;
    }

    optionSourceCatalog = { schemaVersion: 2, sources: [] };
    optionSourceCatalogError =
      error instanceof Error
        ? error.message
        : "옵션 출처 카탈로그를 불러오지 못했습니다.";
    rerenderCurrentSelectDraft();
    if (showError) {
      showScreenSaveStatus(optionSourceCatalogError, "error");
    }
    return null;
  }
}

async function loadCurrentStateScopes({ showError = false } = {}) {
  const wireframeKey = activeWireframeKey;

  if (!wireframeKey) {
    stateScopeCatalog = { schemaVersion: 1, scopes: [] };
    stateScopeCatalogError = "";
    renderCurrentStateScope();
    return null;
  }

  const requestVersion = ++stateScopeRequestVersion;

  try {
    const catalog = normalizeStateScopeCatalog(
      await loadStateScopesFromLocal({ wireframeKey })
    );

    if (
      requestVersion !== stateScopeRequestVersion ||
      wireframeKey !== activeWireframeKey
    ) {
      return null;
    }

    stateScopeCatalog = catalog;
    stateScopeCatalogError = "";
    renderCurrentStateScope();
    return catalog;
  } catch (error) {
    if (requestVersion !== stateScopeRequestVersion) {
      return null;
    }

    stateScopeCatalog = { schemaVersion: 1, scopes: [] };
    stateScopeCatalogError =
      error instanceof Error
        ? error.message
        : "상태 스코프 카탈로그를 불러오지 못했습니다.";
    renderCurrentStateScope();
    if (showError) {
      showScreenSaveStatus(stateScopeCatalogError, "error");
    }
    return null;
  }
}

function hideCancelRegistrationConfirmation() {
  cancelRegistrationConfirmation.hidden = true;
}

function selectElementType(elementType) {
  const option = typeOptions.find(({ value }) => value === elementType);

  if (!option) {
    return;
  }

  for (const button of elementTypeOptions.querySelectorAll("button")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.elementType === elementType)
    );
  }

  currentElementType = elementType;
  selectedElementType.textContent = `등록된 유형: ${option.label}`;
  registrationControls.hidden = false;
  hideCancelRegistrationConfirmation();
}

function renderElementTypeOptions() {
  elementTypeOptions.replaceChildren(
    ...typeOptions.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.elementType = option.value;
      button.textContent = option.label;
      button.setAttribute("aria-pressed", "false");
      return button;
    })
  );
}

function resetElementTypeSelection() {
  currentElementType = null;
  registrationControls.hidden = true;
  selectedElementType.textContent = "";
  hideCancelRegistrationConfirmation();

  for (const button of elementTypeOptions.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", "false");
  }

  schemaKeysSection.hidden = true;
  schemaKeys.replaceChildren();
}

function createSchemaCodeLabel(value) {
  const code = document.createElement("code");
  code.textContent = value;
  return code;
}

function createOptionSourceDetailItem(key, value, className = "") {
  const item = document.createElement("li");
  const detail = document.createElement("span");
  detail.className = `option-source-detail ${className}`.trim();
  detail.textContent = value;
  item.append(createSchemaCodeLabel(key), detail);
  return item;
}

function createStaticOptionSourceDetails(source) {
  const options = Array.isArray(source.options) ? source.options : [];
  const item = document.createElement("li");
  item.className = "option-source-options-item";

  const details = document.createElement("details");
  details.className = "option-source-options";
  const summary = document.createElement("summary");
  const updateSummary = () => {
    summary.textContent = `선택지 ${options.length}개 · ${
      details.open ? "접기" : "펼쳐보기"
    }`;
  };
  details.addEventListener("toggle", updateSummary);
  updateSummary();

  const content = document.createElement("div");
  content.className = "option-source-options-content";
  const optionList = document.createElement("ol");
  optionList.className = "option-source-option-list";
  const emptyMessage = document.createElement("p");
  emptyMessage.className = "option-source-option-empty";
  emptyMessage.textContent = "일치하는 선택지가 없습니다.";

  const renderOptions = (query = "") => {
    const filteredOptions = filterOptionSourceOptions(options, query);
    optionList.replaceChildren(
      ...filteredOptions.map((option) => {
        const optionItem = document.createElement("li");
        optionItem.className = "option-source-option";

        const value = createSchemaCodeLabel(String(option.value));
        value.className = "option-source-option-value";
        const arrow = document.createElement("span");
        arrow.className = "option-source-option-arrow";
        arrow.textContent = "→";
        const label = document.createElement("span");
        label.className = "option-source-option-label";
        label.textContent = option.label;
        optionItem.append(value, arrow, label);

        if (option.disabled === true) {
          const disabled = document.createElement("span");
          disabled.className = "option-source-option-disabled";
          disabled.textContent = "disabled";
          optionItem.append(disabled);
        }

        return optionItem;
      })
    );
    emptyMessage.hidden = filteredOptions.length > 0;
  };

  if (options.length > STATIC_OPTION_SEARCH_THRESHOLD) {
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "schema-text-input option-source-option-search";
    searchInput.placeholder = "value 또는 label 검색";
    searchInput.setAttribute("aria-label", "정적 선택지 검색");
    searchInput.addEventListener("input", () => {
      renderOptions(searchInput.value);
    });
    content.append(searchInput);
  }

  renderOptions();
  content.append(optionList, emptyMessage);
  details.append(summary, content);
  item.append(details);
  return item;
}

function getRegisteredFieldKeys() {
  return [
    ...new Set(
      nodeDraftStore
        .entries()
        .filter((draft) => draft.nodeId !== currentSelection?.nodeId)
        .map((draft) => draft.values.fieldKey?.trim())
        .filter(Boolean)
    )
  ];
}

function parseOptionSourceParams(savedValues) {
  const rawValue = savedValues?.["optionsSource.params"];

  if (typeof rawValue !== "string" || rawValue === "") {
    return {};
  }

  try {
    const value = JSON.parse(rawValue);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

function isTrueValue(value) {
  return value === true || value === "true";
}

function parseJsonArrayValue(value) {
  if (typeof value !== "string" || value === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getScreenRequiredFieldCandidates() {
  return getRequiredFieldCandidates(
    nodeDraftStore.entries().map((draft) => ({
      type: draft.elementType,
      fieldKey: draft.values.fieldKey,
      label: draft.values.label,
      required: isTrueValue(draft.values.required),
      enabledWhen: parseJsonArrayValue(draft.values.enabledWhen)
    }))
  );
}

function createAbsentObjectMarkerItem(propertyPath) {
  // 로컬 JSON에서 생략된 선택적 object의 부재를 폼 값으로 보존해
  // 재저장 시 기본 구조가 다시 붙지 않게 한다.
  const item = document.createElement("li");
  item.hidden = true;

  const marker = document.createElement("input");
  marker.type = "hidden";
  marker.name = propertyPath;
  marker.value = "";

  item.append(marker);
  return item;
}

function createButtonExecutionReviewItem(alwaysExecutes) {
  const item = document.createElement("li");
  item.className = "button-execution-review-item";

  const heading = document.createElement("strong");
  heading.textContent = "실행 조건 해석";

  if (alwaysExecutes) {
    const always = document.createElement("p");
    always.textContent =
      "이 버튼은 실행 조건 없이 항상 실행됩니다. 필수값 판정을 하지 않습니다.";
    item.append(heading, always);
    return item;
  }

  const description = document.createElement("p");
  description.textContent =
    "현재 화면의 활성화된 필수 입력·선택 필드가 모두 값을 가져야 합니다.";

  const candidates = getScreenRequiredFieldCandidates();
  const candidateHeading = document.createElement("span");
  candidateHeading.className = "button-execution-candidate-heading";
  candidateHeading.textContent = `판정 후보 ${candidates.length}개`;

  const candidateList = document.createElement("div");
  candidateList.className = "button-execution-candidates";

  if (candidates.length === 0) {
    const empty = document.createElement("span");
    empty.className = "button-execution-empty";
    empty.textContent = "현재 등록된 판정 후보가 없습니다.";
    candidateList.append(empty);
  } else {
    candidateList.append(
      ...candidates.map((candidate) => {
        const code = document.createElement("code");
        code.textContent = candidate.fieldKey;
        code.title = candidate.label;
        return code;
      })
    );
  }

  const applicability = document.createElement("p");
  applicability.textContent = "enabledWhen을 만족한 후보만 판정합니다.";

  const blocked = document.createElement("p");
  blocked.textContent =
    "차단 시 누락 오류를 표시하고 첫 누락 필드로 이동합니다.";

  item.append(
    heading,
    description,
    candidateHeading,
    candidateList,
    applicability,
    blocked
  );
  return item;
}

function updateOptionSourceReadiness(
  detail,
  source,
  { searchable, params, availableFieldKeys }
) {
  const readiness = getOptionSourceReadiness(source, {
    searchable,
    params,
    availableFieldKeys
  });
  detail.dataset.ready = String(readiness.ready);
  detail.textContent = readiness.ready
    ? "완료"
    : `미완료 · ${readiness.issues.join(" ")}`;
}

function formatOptionSourceLoadOn(loadOn) {
  return loadOn === "search" ? "검색어 입력 시" : "메뉴를 열 때";
}

function appendOptionSourceSearchDetails(nestedList, search) {
  nestedList.append(
    createOptionSourceDetailItem("search.mode", search.mode)
  );

  if (search.mode !== "remote") {
    return;
  }

  nestedList.append(
    createOptionSourceDetailItem("search.queryParam", search.queryParam),
    createOptionSourceDetailItem("search.minLength", String(search.minLength)),
    createOptionSourceDetailItem(
      "search.debounceMs",
      `${search.debounceMs}ms`
    )
  );
}

function appendRemoteOptionSourceDetails(nestedList, source) {
  nestedList.append(
    createOptionSourceDetailItem(
      "request",
      `${source.request.method} ${source.request.path}`,
      "option-source-contract-detail"
    ),
    createOptionSourceDetailItem(
      "loadOn",
      formatOptionSourceLoadOn(source.request.loadOn)
    )
  );

  if (source.request.search) {
    appendOptionSourceSearchDetails(nestedList, source.request.search);
  }

  nestedList.append(
    createOptionSourceDetailItem(
      "response.options[].value",
      "string · 실제 저장할 ID",
      "option-source-contract-detail"
    ),
    createOptionSourceDetailItem(
      "response.options[].label",
      "string · 사용자 표시명",
      "option-source-contract-detail"
    ),
    createOptionSourceDetailItem(
      "response.options[].disabled",
      "boolean · 선택값 · 기본 false",
      "option-source-contract-detail"
    )
  );

  for (const messageKey of ["idle", "loading", "empty", "error"]) {
    nestedList.append(
      createOptionSourceDetailItem(
        `messages.${messageKey}`,
        source.messages[messageKey],
        "option-source-contract-detail"
      )
    );
  }
}

function createOptionsSourcePropertyItem(savedValues) {
  const item = document.createElement("li");
  item.classList.add("schema-object-item");
  item.append(createSchemaCodeLabel("optionsSource"));

  const nestedList = document.createElement("ul");
  nestedList.className = "schema-object-keys";

  const keyItem = document.createElement("li");
  const keySelect = document.createElement("select");
  keySelect.name = "optionsSource.key";
  keySelect.className = "schema-select";
  keySelect.setAttribute("aria-label", "optionsSource.key");

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "선택하지 않음";
  keySelect.append(emptyOption);
  for (const source of optionSourceCatalog.sources) {
    const option = document.createElement("option");
    option.value = source.key;
    option.textContent = source.key;
    keySelect.append(option);
  }

  const savedKey = savedValues?.["optionsSource.key"] ?? "";
  if (
    savedKey &&
    !findOptionSourceByKey(optionSourceCatalog, savedKey)
  ) {
    const unknownOption = document.createElement("option");
    unknownOption.value = savedKey;
    unknownOption.textContent = `${savedKey} (카탈로그에 없음)`;
    keySelect.append(unknownOption);
  }
  keySelect.value = savedKey;
  keyItem.append(createSchemaCodeLabel("key"), keySelect);
  nestedList.append(keyItem);

  const savedParams = parseOptionSourceParams(savedValues);
  const fieldKeys = getRegisteredFieldKeys();
  const source = findOptionSourceByKey(optionSourceCatalog, savedKey);
  if (savedKey) {
    const readinessItem = createOptionSourceDetailItem(
      "구현 준비",
      "",
      "option-source-readiness"
    );
    updateOptionSourceReadiness(
      readinessItem.querySelector(".option-source-readiness"),
      source,
      {
        searchable: isTrueValue(savedValues?.searchable),
        params: savedParams,
        availableFieldKeys: fieldKeys
      }
    );
    nestedList.append(readinessItem);
  }

  if (source) {
    nestedList.append(
      createOptionSourceDetailItem(
        "type",
        source.type,
        "option-source-type"
      ),
      createOptionSourceDetailItem("설명", source.description)
    );

    if (source.type === "static") {
      nestedList.append(createStaticOptionSourceDetails(source));
    } else {
      appendRemoteOptionSourceDetails(nestedList, source);
    }
  } else if (optionSourceCatalogError) {
    nestedList.append(
      createOptionSourceDetailItem("카탈로그", optionSourceCatalogError)
    );
  }

  const paramsItem = document.createElement("li");
  paramsItem.classList.add("option-source-params-item");
  const paramsContent = document.createElement("div");
  paramsContent.className = "option-source-params";
  const normalizedParams = {};

  for (const paramName of source?.params ?? []) {
    const mapping = document.createElement("label");
    mapping.className = "option-source-param";
    const mappingName = document.createElement("code");
    mappingName.textContent = `${paramName} ←`;
    const mappingSelect = document.createElement("select");
    mappingSelect.className = "schema-select";
    mappingSelect.dataset.optionSourceParam = paramName;
    mappingSelect.setAttribute(
      "aria-label",
      `optionsSource.params.${paramName}`
    );

    const unknownOption = document.createElement("option");
    unknownOption.value = "";
    unknownOption.textContent = "선택하지 않음";
    mappingSelect.append(unknownOption);
    for (const fieldKey of fieldKeys) {
      const option = document.createElement("option");
      option.value = fieldKey;
      option.textContent = fieldKey;
      mappingSelect.append(option);
    }

    const savedMapping =
      typeof savedParams[paramName] === "string"
        ? savedParams[paramName]
        : "";
    if (savedMapping && !fieldKeys.includes(savedMapping)) {
      const option = document.createElement("option");
      option.value = savedMapping;
      option.textContent = `${savedMapping} (등록 필드에 없음)`;
      mappingSelect.append(option);
    }
    mappingSelect.value = savedMapping;
    if (savedMapping) {
      normalizedParams[paramName] = savedMapping;
    }
    mapping.append(mappingName, mappingSelect);
    paramsContent.append(mapping);
  }

  const paramsInput = document.createElement("input");
  paramsInput.type = "hidden";
  paramsInput.name = "optionsSource.params";
  paramsInput.value = Object.keys(normalizedParams).length
    ? JSON.stringify(normalizedParams)
    : "";
  paramsContent.append(paramsInput);
  paramsItem.append(createSchemaCodeLabel("params"), paramsContent);
  nestedList.append(paramsItem);

  keySelect.addEventListener("change", () => {
    const values = collectCurrentSchemaValues();
    values["optionsSource.key"] = keySelect.value;
    values["optionsSource.params"] = "";
    renderSchemaKeys("select", values);
    saveCurrentDraft();
  });

  for (const mappingSelect of paramsContent.querySelectorAll(
    "[data-option-source-param]"
  )) {
    mappingSelect.addEventListener("change", () => {
      const nextParams = {};
      for (const control of paramsContent.querySelectorAll(
        "[data-option-source-param]"
      )) {
        if (control.value) {
          nextParams[control.dataset.optionSourceParam] = control.value;
        }
      }
      paramsInput.value = Object.keys(nextParams).length
        ? JSON.stringify(nextParams)
        : "";
    });
  }

  item.append(nestedList);
  return item;
}

function refreshRenderedOptionSourceReadiness() {
  const detail = schemaKeys.querySelector(".option-source-readiness");
  const keyControl = schemaKeys.querySelector('[name="optionsSource.key"]');

  if (!detail || !keyControl) {
    return;
  }

  const values = collectCurrentSchemaValues();
  updateOptionSourceReadiness(
    detail,
    findOptionSourceByKey(optionSourceCatalog, keyControl.value),
    {
      searchable: isTrueValue(values.searchable),
      params: parseOptionSourceParams(values),
      availableFieldKeys: getRegisteredFieldKeys()
    }
  );
}

function createSchemaPropertyItem(
  schema,
  propertyKey,
  savedValues,
  parentPath = ""
) {
  if (!parentPath && propertyKey === "optionsSource") {
    return createOptionsSourcePropertyItem(savedValues);
  }

  const propertyPath = parentPath
    ? `${parentPath}.${propertyKey}`
    : propertyKey;
  const item = document.createElement("li");
  const keyCode = document.createElement("code");
  keyCode.textContent = propertyKey;
  item.append(keyCode);

  const editorKind = getSchemaPropertyEditorKind(schema, propertyKey);
  const constantValue = getSchemaConstantValue(schema, propertyKey);

  if (constantValue !== undefined) {
    const fixedValue = document.createElement("span");
    fixedValue.className = "schema-constant";

    const label = document.createElement("span");
    label.textContent = "고정값";

    const valueCode = document.createElement("code");
    valueCode.textContent = String(constantValue);

    fixedValue.append(label, valueCode);
    item.append(fixedValue);
  }

  if (editorKind === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = propertyPath;
    input.className = "schema-text-input";
    input.setAttribute("aria-label", propertyPath);
    input.setAttribute("autocomplete", "off");

    const suggestionKeyByProperty = {
      label: "suggestedLabel",
      placeholder: "suggestedPlaceholder",
      initialValue: "suggestedInitialValue"
    };
    const suggestionKey = parentPath
      ? undefined
      : suggestionKeyByProperty[propertyKey];

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      input.value = savedValues[propertyPath];
    } else if (suggestionKey) {
      input.value = currentSelection?.[suggestionKey] ?? "";
    }

    item.append(input);
  }

  if (editorKind === "number") {
    const property = schema.properties[propertyKey];
    const input = document.createElement("input");
    input.type = "number";
    input.name = propertyPath;
    input.className = "schema-text-input";
    input.setAttribute("aria-label", propertyPath);
    input.setAttribute("autocomplete", "off");

    if (property.type === "integer") {
      input.step = "1";
    }
    if (typeof property.minimum === "number") {
      input.min = String(property.minimum);
    }
    if (typeof property.maximum === "number") {
      input.max = String(property.maximum);
    }

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      input.value = savedValues[propertyPath];
    }

    item.append(input);
  }

  if (editorKind === "boolean") {
    const select = document.createElement("select");
    select.name = propertyPath;
    select.className = "schema-select";
    select.setAttribute("aria-label", propertyPath);

    const unknownOption = document.createElement("option");
    unknownOption.value = "";
    unknownOption.textContent = "미정";

    const trueOption = document.createElement("option");
    trueOption.value = "true";
    trueOption.textContent = "true";

    const falseOption = document.createElement("option");
    falseOption.value = "false";
    falseOption.textContent = "false";

    select.append(unknownOption, trueOption, falseOption);

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      select.value = savedValues[propertyPath];
    } else if (
      !parentPath &&
      propertyKey === "required" &&
      typeof currentSelection?.suggestedRequired === "boolean"
    ) {
      select.value = String(currentSelection.suggestedRequired);
    }

    item.append(select);
  }

  if (editorKind === "enum") {
    const select = document.createElement("select");
    select.name = propertyPath;
    select.className = "schema-select";
    select.setAttribute("aria-label", propertyPath);

    const enumValues = getSchemaEnumValues(schema, propertyKey);

    select.append(
      ...enumValues.map((enumValue) => {
        const option = document.createElement("option");
        option.value = String(enumValue);
        option.textContent = String(enumValue);
        return option;
      })
    );

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      select.value = savedValues[propertyPath];
    }

    item.append(select);
  }

  if (editorKind === "empty-array") {
    const defaultValue = document.createElement("span");
    defaultValue.className = "schema-constant";

    const label = document.createElement("span");
    label.textContent = "기본값";

    const valueCode = document.createElement("code");
    valueCode.textContent = "[]";

    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = propertyPath;
    hiddenInput.value = "[]";

    defaultValue.append(label, valueCode, hiddenInput);
    item.append(defaultValue);
  }

  if (editorKind === "json-array") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = propertyPath;
    input.className = "schema-text-input";
    input.setAttribute("aria-label", propertyPath);
    input.setAttribute("autocomplete", "off");
    input.placeholder = "JSON 배열";

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      input.value = savedValues[propertyPath];
    }

    item.append(input);
  }

  if (editorKind === "json-object") {
    const input = document.createElement("input");
    input.type = "text";
    input.name = propertyPath;
    input.className = "schema-text-input";
    input.setAttribute("aria-label", propertyPath);
    input.setAttribute("autocomplete", "off");
    input.placeholder = "JSON 객체";

    if (savedValues && hasOwn(savedValues, propertyPath)) {
      input.value = savedValues[propertyPath];
    }

    item.append(input);
  }

  if (editorKind === "object") {
    item.classList.add("schema-object-item");
    const propertySchema = schema.properties[propertyKey];
    const nestedKeys = getSchemaPropertyKeys(propertySchema);
    const isAbsentOptionalObject = (nestedKey) =>
      getSchemaPropertyEditorKind(propertySchema, nestedKey) === "object" &&
      !(
        Array.isArray(propertySchema.required) &&
        propertySchema.required.includes(nestedKey)
      ) &&
      savedValues?.[`${propertyPath}.${nestedKey}`] === "";
    const nestedList = document.createElement("ul");
    nestedList.className = "schema-object-keys";
    nestedList.replaceChildren(
      ...nestedKeys.map((nestedKey) =>
        isAbsentOptionalObject(nestedKey)
          ? createAbsentObjectMarkerItem(`${propertyPath}.${nestedKey}`)
          : createSchemaPropertyItem(
              propertySchema,
              nestedKey,
              savedValues,
              propertyPath
            )
      )
    );

    if (propertyPath === "action") {
      nestedList.append(
        createButtonExecutionReviewItem(
          savedValues?.["action.executeWhen"] === ""
        )
      );
    }

    item.append(nestedList);
  }

  return item;
}

function renderSchemaKeys(elementType, savedValues) {
  const schema = schemaByType[elementType];
  const propertyKeys = getSchemaPropertyKeysForElementType(
    elementType,
    schemaByType
  );

  schemaKeys.replaceChildren(
    ...propertyKeys.map((propertyKey) =>
      createSchemaPropertyItem(schema, propertyKey, savedValues)
    )
  );
  schemaKeysSection.hidden = propertyKeys.length === 0;
}

function renderSelection(node, canEditElement) {
  saveCurrentDraft();
  currentSelection = node;
  currentSelectionCanEdit = canEditElement;
  nodeId.textContent = node.nodeId;
  nodeName.textContent = node.name;
  nodeType.textContent = node.type;
  selectionDetails.hidden = false;
  elementTypeSection.hidden = !canEditElement;
  emptyState.hidden = true;
  resetElementTypeSelection();

  if (!canEditElement) {
    return;
  }

  const draft = nodeDraftStore.load(node.nodeId);

  if (draft) {
    selectElementType(draft.elementType);
    renderSchemaKeys(draft.elementType, draft.values);
  }
}

function renderEmptyState() {
  saveCurrentDraft();
  currentSelection = null;
  currentSelectionCanEdit = false;
  selectionDetails.hidden = true;
  elementTypeSection.hidden = true;
  emptyState.hidden = false;
  resetElementTypeSelection();
}

elementTypeOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-element-type]");

  if (!button) {
    return;
  }

  const option = typeOptions.find(
    ({ value }) => value === button.dataset.elementType
  );

  saveCurrentDraft();
  selectElementType(option.value);
  renderSchemaKeys(option.value);
  saveCurrentDraft();
});

cancelRegistration.addEventListener("click", () => {
  cancelRegistrationConfirmation.hidden = false;
});

keepRegistration.addEventListener(
  "click",
  hideCancelRegistrationConfirmation
);

confirmCancelRegistration.addEventListener("click", () => {
  const selectedNodeId = currentSelection?.nodeId;

  if (!selectedNodeId || !nodeDraftStore.remove(selectedNodeId)) {
    return;
  }

  resetElementTypeSelection();
});

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

saveScreen.addEventListener("click", () => {
  if (hasUnloadedLocalChanges) {
    showScreenSaveStatus(
      "로컬 JSON에 새 변경이 있습니다. 최신 초안을 먼저 불러오세요.",
      "error"
    );
    return;
  }

  saveCurrentDraft();
  clearScreenSaveStatus();
  setScreenSaveBusy(true);

  parent.postMessage(
    {
      pluginMessage: {
        type: "save-screen-spec",
        stateScopeKey: currentScreenStateScopeKey || undefined,
        meta: currentScreenMeta ?? undefined,
        drafts: nodeDraftStore.entries()
      }
    },
    "*"
  );
});

saveFigmaRaw.addEventListener("click", () => {
  clearScreenSaveStatus();
  setFigmaRawSaveBusy(true);

  parent.postMessage(
    { pluginMessage: { type: "export-figma-raw" } },
    "*"
  );
});

loadLocalScreen.addEventListener("click", async () => {
  clearScreenSaveStatus();
  await Promise.all([
    loadCurrentOptionSources({ showError: true }),
    loadCurrentStateScopes({ showError: true })
  ]);
  const result = await checkLocalScreenSpec({ showUnchanged: true });

  if (!result || result.status !== "loaded") {
    return;
  }

  setLocalLoadBusy(true);
  saveScreen.disabled = true;
  parent.postMessage(
    {
      pluginMessage: {
        type: "prepare-local-screen-spec",
        revision: result.revision,
        screenSpec: result.screenSpec
      }
    },
    "*"
  );
});

schemaKeys.addEventListener("input", saveCurrentDraft);
schemaKeys.addEventListener("change", () => {
  saveCurrentDraft();
  refreshRenderedOptionSourceReadiness();
});

window.onmessage = async (event) => {
  const message = event.data.pluginMessage;

  if (message?.type === "screen-context-error") {
    showScreenContextError(message.message);
    return;
  }

  if (message?.type === "screen-spec-error") {
    setScreenSaveBusy(false);
    showScreenSaveStatus(message.message, "error");
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

      if (message.assetsError) {
        failures.push(message.assetsError);
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
                error instanceof Error ? error.message : "저장 실패"
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
            error instanceof Error ? error.message : "reference.png 저장 실패"
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
        error instanceof Error
          ? error.message
          : "Figma 원본 JSON을 저장하지 못했습니다.",
        "error"
      );
    } finally {
      setFigmaRawSaveBusy(false);
    }
    return;
  }

  if (message?.type === "local-screen-spec-error") {
    setLocalLoadBusy(false);
    saveScreen.disabled = false;
    showScreenSaveStatus(message.message, "error");
    return;
  }

  if (message?.type === "local-screen-spec-ready") {
    replaceScreenDrafts(message.screenSpec);
    currentScreenStateScopeKey = message.screenSpec.stateScopeKey ?? "";
    currentScreenMeta = message.screenSpec.meta ?? null;
    renderCurrentStateScope();
    localRevision = message.revision;
    setLocalChangedState(false);
    saveScreen.disabled = false;
    showScreenSaveStatus(
      `${getScreenSpecFileName(message.screenSpec)}에서 ${message.screenSpec.elements.length}개 요소를 불러왔습니다. 검토한 뒤 저장하세요.`
    );
    return;
  }

  if (message?.type === "screen-spec-saved") {
    currentPersistedScreenSpec = message.screenSpec;
    currentScreenStateScopeKey = message.screenSpec.stateScopeKey ?? "";
    currentScreenMeta = message.screenSpec.meta ?? null;
    renderCurrentStateScope();
    try {
      const result = await saveScreenSpecToLocal({
        expectedRevision: localRevision,
        wireframeKey: message.wireframeKey,
        screenSpec: message.screenSpec
      });
      localRevision = result.revision;
      setLocalChangedState(false);
      showScreenSaveStatus(
        `${getScreenSpecFileName(message.screenSpec)}을 로컬 작업 폴더에 저장했습니다.`
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "로컬 파일 저장에 실패했습니다.";
      if (detail.includes("최신 초안을 다시 불러오세요")) {
        setLocalChangedState(true);
      }
      showScreenSaveStatus(
        `Figma 내부 저장은 완료했지만 ${detail}`,
        "error"
      );
    } finally {
      setScreenSaveBusy(false);
    }
    return;
  }

  if (message?.type !== "plugin-state") {
    return;
  }

  const screenChanged = syncScreenDrafts(
    message.activeScreen,
    message.screenSpec
  );
  currentActiveScreen = message.activeScreen;
  activeWireframeKey = message.wireframeKey;
  currentPersistedScreenSpec = message.screenSpec;
  if (screenChanged) {
    currentScreenStateScopeKey = message.screenSpec?.stateScopeKey ?? "";
    currentScreenMeta = message.screenSpec?.meta ?? null;
  }
  renderCurrentScreen(message.activeScreen, message.wireframeKey);
  renderScreenCandidate(
    message.screenCandidate,
    message.wireframeKey,
    message.activeScreen
  );
  renderSelectionNotice(
    message.selectionScope,
    Boolean(message.screenCandidate)
  );

  if (message.selectedNode) {
    renderSelection(
      message.selectedNode,
      message.selectionScope === "inside"
    );
  } else {
    renderEmptyState();
  }

  if (screenChanged && message.activeScreen) {
    void checkLocalScreenSpec();
    void loadCurrentOptionSources();
    void loadCurrentStateScopes();
  }
};

renderElementTypeOptions();
parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
