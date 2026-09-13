import { isObject } from "./spec-validation-values.mjs";

// 겹쳐 뜨는 화면은 보는 사람을 따로 말하지 않는다 - 뒤에 남는 화면이 이미
// 말했고, 둘이 갈리면 무엇이 맞는지 아무도 모른다.
export function checkOverlayViewer(findings, file, spec) {
  if (isObject(spec.overlay) && typeof spec.viewer === "string") {
    findings.push({
      level: "error",
      file,
      message: `겹쳐 뜨는 화면은 보는 사람(viewer)을 따로 말하지 않습니다. 뒤에 남는 화면 '${spec.overlay.screenId}'이 이미 말합니다.`
    });
  }
}

// 셸의 메뉴도 같다. 겹쳐 뜨는 화면은 뒤에 남는 화면을 그리게 하고, 그 화면이
// 셸을 그린다 - 겹치는 쪽이 적어 두면 아무도 읽지 않는 값이 명세에 남는다.
// 열 곳 모두 그렇게 살고 있었고, 둘이 갈리면 무엇이 맞는지 아무도 모른다.
export function checkOverlayNavigation(findings, file, spec) {
  if (isObject(spec.overlay) && typeof spec.activeNavigationScreenId === "string") {
    findings.push({
      level: "error",
      file,
      message: `겹쳐 뜨는 화면은 셸의 메뉴(activeNavigationScreenId)를 따로 말하지 않습니다. 뒤에 남는 화면 '${spec.overlay.screenId}'이 이미 말합니다.`
    });
  }
}

export function collectScreenWorkspaceFindings({ file, spec, shell }) {
  const findings = [];
  // 작업 공간. 화면은 key만 가리키므로, 가리킨 곳이 없거나 그 공간이 요구하는
  // 인자를 화면이 받지 않으면 **제목과 상태 줄이 통째로 빈다** — 요소가 아니라
  // 아무도 안 본다.
  const workspace = isObject(spec.workspace) ? spec.workspace : null;
  if (workspace) {
    const declared = (isObject(shell) && Array.isArray(shell.workspaces)
      ? shell.workspaces
      : []
    ).find((candidate) => candidate?.key === workspace.key);
    if (!isObject(shell) || !Array.isArray(shell.workspaces)) {
      findings.push({
        level: "warning",
        file,
        message: `shell.json에 작업 공간 목록이 없어 '${workspace.key}'를 확인하지 못했습니다.`
      });
    } else if (!declared) {
      findings.push({
        level: "error",
        file,
        message: `작업 공간 '${workspace.key}'가 shell.json에 없습니다.`
      });
    } else {
      const screenParamKeys = new Set(
        (Array.isArray(spec.params) ? spec.params : [])
          .map((param) => param?.key)
          .filter((key) => typeof key === "string")
      );
      if (!screenParamKeys.has(declared.param)) {
        findings.push({
          level: "error",
          file,
          message: `작업 공간 '${workspace.key}'는 인자 '${declared.param}'로 무엇의 공간인지를 정하는데 이 화면이 그것을 받지 않습니다(params에 없습니다).`
        });
      }
      // 갈피가 이 화면을 가리키는지. 없으면 갈피 줄에 지금 자리가 표시되지 않는다.
      //
      // 갈피 아래로 한 겹 더 들어가는 화면은 자기를 가리키는 갈피가 없다. 그때는
      // 어느 갈피 아래인지를 화면이 말하고, 켜지는 것은 그 갈피다.
      const activeTab = workspace.activeTabScreenId ?? spec.screenId;
      if (workspace.activeTabScreenId === spec.screenId) {
        findings.push({
          level: "error",
          file,
          message: `작업 공간 '${workspace.key}'의 activeTabScreenId가 이 화면 자신을 가리킵니다. 갈피면 적지 않고, 갈피가 아니면 다른 화면을 가리킵니다.`
        });
      }
      const here = (declared.tabs ?? []).filter((item) => item?.targetScreenId === activeTab);
      if (here.length === 0) {
        findings.push({
          level: "warning",
          file,
          message: `작업 공간 '${workspace.key}'의 갈피 중 '${activeTab}'을 가리키는 것이 없습니다. 갈피 줄이 지금 어디인지 표시하지 못합니다.`
        });
      } else if (here.length > 1) {
        findings.push({
          level: "error",
          file,
          message: `작업 공간 '${workspace.key}'의 갈피 ${here.length}개가 같은 화면 '${activeTab}'을 가리킵니다.`
        });
      }
    }
  }
  return findings;
}

export function collectScreenShellFindings({ file, spec, shell }) {
  const findings = [];
  checkOverlayViewer(findings, file, spec);
  checkOverlayNavigation(findings, file, spec);

  // 셸의 어느 메뉴 아래인지. 갈피의 activeTabScreenId와 같은 축이고, 가리키는
  // 화면이 실제로 메뉴여야 켜진다.
  if (typeof spec.activeNavigationScreenId === "string") {
    if (spec.activeNavigationScreenId === spec.screenId) {
      findings.push({
        level: "error",
        file,
        message: `activeNavigationScreenId가 이 화면 자신을 가리킵니다. 메뉴가 가리키는 화면이면 적지 않습니다.`
      });
    } else if (isObject(shell) && Array.isArray(shell.navigation)) {
      const menu = shell.navigation.filter(
        (item) => item?.targetScreenId === spec.activeNavigationScreenId
      );
      if (menu.length === 0) {
        findings.push({
          level: "error",
          message: `activeNavigationScreenId '${spec.activeNavigationScreenId}'를 가리키는 셸 메뉴가 없습니다. 켜질 메뉴가 없으면 적을 뜻이 없습니다.`,
          file
        });
      }
    }
  }
  return findings;
}

export function collectShellFindings({ shell, shellFile, screenIds, dataSources, dataSourceByKey }) {
  const findings = [];
  // 화면 셸: 화면마다 복사하지 않으려고 카탈로그로 뺐으므로, 셸이 가리키는
  // 화면과 데이터 조각은 어느 화면도 검사해 주지 않는다. 여기서 본다.
  if (isObject(shell)) {
    for (const item of shell.navigation ?? []) {
      const targetScreenId = item?.targetScreenId;
      if (typeof targetScreenId === "string" && !screenIds.has(targetScreenId)) {
        findings.push({
          level: "warning",
          file: shellFile,
          message: `셸 메뉴 '${item.label}'의 이동 대상 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
        });
      }
    }

    // 작업 공간. 갈피가 가리키는 화면과 제목·상태 줄이 읽는 조각을 본다 —
    // 화면 쪽 검사는 key만 보므로 여기가 아니면 아무도 안 본다.
    for (const workspace of shell.workspaces ?? []) {
      for (const item of workspace.tabs ?? []) {
        const targetScreenId = item?.targetScreenId;
        if (typeof targetScreenId === "string" && !screenIds.has(targetScreenId)) {
          findings.push({
            level: "warning",
            file: shellFile,
            message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 가리키는 화면 '${targetScreenId}'의 명세 파일이 아직 없습니다.`
          });
        }

        // 갈피가 공간의 상태에 따라 갈릴 때. **가르는 것은 열쇠이지 그려지는
        // 말이 아니다** — 그 열쇠가 상태 줄이 읽는 출처에 없으면, 갈래는 늘
        // 기본으로 떨어지고 아무도 그 사실을 모른다.
        if (typeof item?.targetField === "string") {
          const statusKey = workspace.status?.dataSourceKey;
          const statusSource = statusKey ? dataSourceByKey.get(statusKey) : undefined;
          if (!statusSource) {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 상태로 갈리는데 이 공간에는 상태 줄이 없습니다.`
            });
          } else if (!(statusSource.fields ?? []).some((f) => f?.key === item.targetField)) {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 가리킨 조각 '${item.targetField}'가 상태 줄의 출처 '${statusKey}'에 없습니다.`
            });
          }
          if (typeof targetScreenId !== "string") {
            findings.push({
              level: "error",
              file: shellFile,
              message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 상태로 갈리는데 기본 화면(targetScreenId)이 없습니다. 갈피는 늘 갈 곳이 있어야 합니다.`
            });
          }
          for (const target of item.targets ?? []) {
            if (typeof target?.targetScreenId !== "string") {
              continue;
            }
            if (!screenIds.has(target.targetScreenId)) {
              findings.push({
                level: "warning",
                file: shellFile,
                message: `작업 공간 '${workspace.key}'의 갈피 '${item.label}'이 '${target.value}'일 때 가리키는 화면 '${target.targetScreenId}'의 명세 파일이 아직 없습니다.`
              });
            }
          }
        }
      }
    }

    const shellRefs = [
      { part: "brand", ref: shell.brand, fields: ["subtitleField"] },
      { part: "viewer", ref: shell.viewer, fields: ["nameField", "roleField"] },
      ...(shell.workspaces ?? []).flatMap((workspace) => [
        {
          part: `작업 공간 '${workspace.key}'의 제목`,
          ref: workspace.titleFrom,
          fields: ["field"]
        },
        {
          part: `작업 공간 '${workspace.key}'의 상태 줄`,
          ref: workspace.status,
          // items[].field는 아래에서 따로 편다.
          fields: (workspace.status?.items ?? []).map((_, at) => `items.${at}.field`)
        }
      ])
    ];
    for (const { part, ref, fields } of shellRefs) {
      const key = ref?.dataSourceKey;
      if (typeof key !== "string") {
        continue;
      }
      if (!isObject(dataSources)) {
        findings.push({
          level: "warning",
          file: shellFile,
          message: `data-sources.json이 없어 셸 ${part}의 데이터 출처 '${key}'를 확인하지 못했습니다.`
        });
        continue;
      }
      const source = dataSourceByKey.get(key);
      if (!source) {
        findings.push({
          level: "error",
          file: shellFile,
          message: `셸 ${part}의 데이터 출처 '${key}'가 카탈로그에 없습니다.`
        });
        continue;
      }
      if (source.shape !== "object") {
        findings.push({
          level: "error",
          file: shellFile,
          message: `셸 ${part}의 데이터 출처 '${key}'는 shape가 'object'여야 하는데 '${source.shape}'입니다.`
        });
        continue;
      }
      const sourceFields = new Set((source.fields ?? []).map((field) => field.key));
      // 'items.0.field'처럼 파고들어야 하는 이름도 온다(작업 공간의 상태 줄).
      const readRef = (name) =>
        name.split(".").reduce((value, part) => (isObject(value) || Array.isArray(value) ? value[part] : undefined), ref);
      for (const fieldName of fields) {
        const field = readRef(fieldName);
        if (typeof field === "string" && !sourceFields.has(field)) {
          findings.push({
            level: "error",
            file: shellFile,
            message: `셸 ${part}가 가리킨 조각 '${field}'가 데이터 출처 '${key}'에 없습니다.`
          });
        }
      }
    }
  }
  return findings;
}
