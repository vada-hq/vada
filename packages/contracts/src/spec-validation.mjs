const FIELD_ELEMENT_TYPES = new Set(["input", "select"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function elementLabel(element, index) {
  const spec = element?.spec;
  const name = spec?.fieldKey ?? spec?.label ?? element?.source?.nodeId;
  return name ? `elements[${index}](${name})` : `elements[${index}]`;
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

function checkScreenAgainstDesign(findings, screen, designEntry) {
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

  const nodeIds = collectDesignNodeIds(design.root);
  spec.elements.forEach((element, index) => {
    const nodeId = element?.source?.nodeId;
    if (typeof nodeId === "string" && !nodeIds.has(nodeId)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 figma.design.json에 없습니다.`
      });
    }
  });

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

function checkOptionsSource(findings, context) {
  const { file, element, index, optionSources, sourceByKey, fieldKeys } = context;
  const optionsSource = element.spec.optionsSource;
  if (!isObject(optionsSource) || typeof optionsSource.key !== "string") {
    return;
  }

  if (!isObject(optionSources)) {
    findings.push({
      level: "warning",
      file,
      message: `option-sources.json이 없어 ${elementLabel(element, index)}의 출처 '${optionsSource.key}'를 확인하지 못했습니다.`
    });
    return;
  }

  const catalogSource = sourceByKey.get(optionsSource.key);
  if (!catalogSource) {
    findings.push({
      level: "error",
      file,
      message: `${elementLabel(element, index)}의 선택지 출처 '${optionsSource.key}'가 카탈로그에 없습니다.`
    });
    return;
  }

  const requiredParams = Array.isArray(catalogSource.params)
    ? catalogSource.params
    : [];
  const mapping = isObject(optionsSource.params) ? optionsSource.params : {};

  for (const param of requiredParams) {
    if (!(param in mapping)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 출처 '${optionsSource.key}'에 필요한 인자 '${param}' 매핑이 없습니다.`
      });
    }
  }
  for (const [param, fieldKey] of Object.entries(mapping)) {
    if (!requiredParams.includes(param)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}가 출처 '${optionsSource.key}'에 없는 인자 '${param}'를 매핑했습니다.`
      });
    }
    if (!fieldKeys.has(fieldKey)) {
      findings.push({
        level: "error",
        file,
        message: `${elementLabel(element, index)}의 인자 '${param}'가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
      });
    }
  }
}

function checkFieldReferences(findings, context) {
  const { file, element, index, fieldKeys } = context;
  const { enabledWhen, resetOnChangeOf } = element.spec;

  if (Array.isArray(enabledWhen)) {
    for (const condition of enabledWhen) {
      const fieldKey = condition?.fieldKey;
      if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 enabledWhen이 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
        });
      }
    }
  }
  if (Array.isArray(resetOnChangeOf)) {
    for (const fieldKey of resetOnChangeOf) {
      if (typeof fieldKey === "string" && !fieldKeys.has(fieldKey)) {
        findings.push({
          level: "error",
          file,
          message: `${elementLabel(element, index)}의 resetOnChangeOf가 참조한 fieldKey '${fieldKey}'가 화면에 없습니다.`
        });
      }
    }
  }
}

export function collectSpecFindings({
  screens = [],
  optionSources = null,
  stateScopes = null,
  designs = {},
  flows = null,
  flowsFile = "flows.json"
} = {}) {
  const findings = [];
  const screenIds = new Set(
    screens
      .map((screen) => screen?.spec?.screenId)
      .filter((screenId) => typeof screenId === "string")
  );
  const sourceByKey = new Map(
    (isObject(optionSources) && Array.isArray(optionSources.sources)
      ? optionSources.sources
      : []
    ).map((source) => [source.key, source])
  );
  const scopeKeys = new Set(
    (isObject(stateScopes) && Array.isArray(stateScopes.scopes)
      ? stateScopes.scopes
      : []
    ).map((scope) => scope.key)
  );

  for (const screen of screens) {
    const { file, spec } = screen;
    if (!isObject(spec) || !Array.isArray(spec.elements)) {
      continue;
    }

    // 위치에서 기대 screenId를 얻는다: screens/<screenId>/screen.json 또는
    // (과거 형태) screens/<screenId>.json 모두 지원한다.
    const segments = String(file).split("/");
    const screensIndex = segments.lastIndexOf("screens");
    const locationId =
      screensIndex >= 0 && segments.length > screensIndex + 1
        ? segments[screensIndex + 1].replace(/\.json$/u, "")
        : undefined;
    if (
      typeof spec.screenId === "string" &&
      locationId &&
      locationId !== spec.screenId
    ) {
      findings.push({
        level: "error",
        file,
        message: `screenId '${spec.screenId}'가 위치 '${locationId}'과 다릅니다.`
      });
    }

    if (typeof spec.stateScopeKey === "string") {
      if (!isObject(stateScopes)) {
        findings.push({
          level: "warning",
          file,
          message: `state-scopes.json이 없어 상태 스코프 '${spec.stateScopeKey}'를 확인하지 못했습니다.`
        });
      } else if (!scopeKeys.has(spec.stateScopeKey)) {
        findings.push({
          level: "error",
          file,
          message: `상태 스코프 '${spec.stateScopeKey}'가 카탈로그에 없습니다.`
        });
      }
    }

    const fieldKeys = new Set();
    const seenFieldKeys = new Set();
    const seenNodeIds = new Set();
    spec.elements.forEach((element, index) => {
      const nodeId = element?.source?.nodeId;
      if (typeof nodeId === "string") {
        if (seenNodeIds.has(nodeId)) {
          findings.push({
            level: "error",
            file,
            message: `${elementLabel(element, index)}의 nodeId '${nodeId}'가 다른 요소와 중복됩니다.`
          });
        }
        seenNodeIds.add(nodeId);
      }

      const spec_ = element?.spec;
      if (isObject(spec_) && FIELD_ELEMENT_TYPES.has(spec_.type)) {
        const fieldKey = spec_.fieldKey;
        if (typeof fieldKey === "string") {
          if (seenFieldKeys.has(fieldKey)) {
            findings.push({
              level: "error",
              file,
              message: `${elementLabel(element, index)}의 fieldKey '${fieldKey}'가 다른 요소와 중복됩니다.`
            });
          }
          seenFieldKeys.add(fieldKey);
          fieldKeys.add(fieldKey);
        }
      }
    });

    spec.elements.forEach((element, index) => {
      const spec_ = element?.spec;
      if (!isObject(spec_)) {
        return;
      }
      const context = {
        file,
        element,
        index,
        optionSources,
        sourceByKey,
        fieldKeys
      };
      if (spec_.type === "select") {
        checkOptionsSource(findings, context);
      }
      checkFieldReferences(findings, context);

      const targetScreenId = spec_.action?.targetScreenId;
      if (
        spec_.type === "button" &&
        typeof targetScreenId === "string" &&
        !screenIds.has(targetScreenId)
      ) {
        findings.push({
          level: "warning",
          file,
          message: `${elementLabel(element, index)}의 이동 대상 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
        });
      }
    });

    checkScreenAgainstDesign(findings, screen, designs[spec.screenId]);
  }

  // 흐름 카탈로그: 참조한 화면의 명세 존재와 단일 멤버십(단계 표시의 유일성)을 검사한다.
  if (isObject(flows) && Array.isArray(flows.flows)) {
    const flowKeysByScreen = new Map();
    for (const flow of flows.flows) {
      if (!isObject(flow) || !Array.isArray(flow.screens)) {
        continue;
      }
      for (const screenId of flow.screens) {
        if (typeof screenId !== "string") {
          continue;
        }
        if (!screenIds.has(screenId)) {
          findings.push({
            level: "warning",
            file: flowsFile,
            message: `흐름 '${flow.key}'의 화면 '${screenId}' 명세가 아직 없습니다.`
          });
        }
        const owners = flowKeysByScreen.get(screenId) ?? [];
        owners.push(flow.key);
        flowKeysByScreen.set(screenId, owners);
      }
    }
    for (const [screenId, owners] of flowKeysByScreen) {
      if (owners.length > 1) {
        findings.push({
          level: "error",
          file: flowsFile,
          message: `화면 '${screenId}'가 여러 흐름(${owners.join(", ")})에 속합니다. 단계 표시가 모호해집니다.`
        });
      }
    }
  }

  return findings;
}
