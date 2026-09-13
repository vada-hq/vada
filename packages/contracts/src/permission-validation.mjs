import { isObject, paramKeys } from "./spec-validation-values.mjs";

/**
 * 권한 규칙이 스스로 어긋나지 않는가.
 *
 * 스키마는 모양만 본다. **이름이 실제로 있는가**는 여기서 본다 — 없는 조건을 가리키는
 * 규칙은 판정할 수가 없고, 판정할 수 없는 자리는 조용히 통과하거나 조용히 막힌다.
 */
function checkPermissions(findings, permissions, file) {
  if (!isObject(permissions)) return;
  const conditions = Array.isArray(permissions.conditions) ? permissions.conditions : [];
  const known = new Set(conditions.map((condition) => condition?.key));
  const areas = Array.isArray(permissions.areas) ? permissions.areas : [];

  const seen = new Set();
  for (const area of areas) {
    if (seen.has(area?.key)) {
      findings.push({ level: "error", file, message: `권한 영역 '${area.key}'가 두 번 있습니다.` });
    }
    seen.add(area?.key);
    for (const [role, rule] of Object.entries(isObject(area?.rules) ? area.rules : {})) {
      if (!known.has(rule?.when)) {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'의 ${role} 규칙이 없는 조건 '${rule?.when}'을 가리킵니다.`
        });
      }
      // 표에 그리는 줄은 칸마다 그려질 말이 있어야 한다. 없으면 화면이 짐작한다.
      if (area?.drawnInMatrix === true && typeof rule?.label !== "string") {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'는 표에 그리는데 ${role} 칸에 그려질 말이 없습니다.`
        });
      }
      if (area?.drawnInMatrix !== true && typeof rule?.label === "string") {
        findings.push({
          level: "error",
          file,
          message: `권한 영역 '${area?.key}'는 표에 그리지 않는데 ${role} 칸에 말이 적혀 있습니다.`
        });
      }
    }
  }

  // 쓰지 않는 조건은 죽은 이름이다. 남아 있으면 다음 사람이 그것을 쓸 수 있는 줄 안다.
  const used = new Set(
    areas.flatMap((area) => Object.values(isObject(area?.rules) ? area.rules : {}).map((rule) => rule?.when))
  );
  for (const condition of conditions) {
    if (!used.has(condition?.key)) {
      findings.push({
        level: "error",
        file,
        message: `조건 '${condition?.key}'를 쓰는 권한 영역이 없습니다.`
      });
    }
  }
}

/**
 * 밖에서 열리는 자리의 인자는 **열쇠인지 아닌지를 말해야 한다.**
 *
 * 로그인이 없거나(공개) 아직 구성원이 아닌 사람이 여는 자리에서는 **그 인자 하나가
 * 유일한 벽인 경우가 있다** — 참석 QR·설문 링크·영수증, 그리고 학생회에 들어오는
 * 초대 코드. 서버는 그런 값을 접속 기록에서 지우는데, 지울 자리를 계약이 말해야
 * 한다(`secret`).
 *
 * **적기를 잊는 쪽이 조용하다.** 표시를 안 하면 아무 일도 안 일어나고 열쇠가 1년
 * 남는다 — 초대 코드가 실제로 그랬다. 그래서 참·거짓 어느 쪽이든 **정하기를**
 * 요구한다. 안 정하면 여기서 멈춘다.
 *
 * 안쪽 자리는 묻지 않는다. `eventId`를 알아도 세션과 소속이 없으면 아무것도 못 여니
 * 그 값은 열쇠가 아니다.
 */
function checkSecretDeclared(findings, permissions, groups) {
  const OPEN = new Set(["public", "signedIn"]);
  for (const [items, what, file] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (!OPEN.has(item?.authorize?.area)) continue;
      for (const param of Array.isArray(item.params) ? item.params : []) {
        if (typeof param?.secret === "boolean") continue;
        findings.push({
          level: "error",
          file,
          message:
            `${what} '${item.key}'의 인자 '${param?.key}'가 밖에서 열리는 자리에 있는데 ` +
            "열쇠인지(secret) 정하지 않았습니다. 참이면 서버가 기록에서 지웁니다."
        });
      }
    }
  }
}

/**
 * **화면을 보는 사람이 그 화면의 출처에 닿을 수 있는가.**
 *
 * 화면마다 누가 보는지가 적혀 있고(`viewer`), 출처마다 누가 열 수 있는지가 적혀
 * 있다(`authorize.area`). 둘은 따로 적히므로 **어긋나도 아무 데서도 안 드러난다** —
 * 명세는 정합하고 화면도 그려지는데, 배포한 뒤 진짜 사람이 열면 그때 403이 온다.
 *
 * 실제로 그랬다: 학생회에 들어오려는 사람이 보는 화면 다섯이 학교·단과대·학부
 * 목록을 읽는데 그 목록들이 `member`를 요구했다. **학교를 골라야 구성원이 되는데
 * 구성원이라야 학교를 고를 수 있었다.** 서버를 지어 붙이다가 사람이 눈으로 찾았고,
 * 눈으로 찾은 것은 다음에 또 놓친다.
 *
 * 규칙은 하나다. 로그인이 없는 화면(`external`)은 `public`에만, 로그인만 한 화면
 * (`joining`)은 `public`과 `signedIn`에만 닿는다. 그 밖의 화면은 구성원이 보므로
 * 무엇에든 닿는다 — 여기서 재지 않는다.
 */
/**
 * 보는 사람이 닿는 영역. **명세가 든다**(`permissions.json`의 `viewerReach`).
 *
 * 한동안 이 표가 여기 상수로 있었다. 규칙이 코드에만 있으면 명세만 읽는 사람은 그
 * 관계를 알 길이 없고, 고칠 때 두 곳을 봐야 한다 — 이 저장소가 역할 이름도 권한 규칙도
 * 명세에 두는 것과 같은 까닭이다.
 *
 * 비어 있는 `reaches`는 **전부에 닿는다**는 뜻이다(구성원). 무엇에 닿는지는 행렬이
 * 정하고 그 판정은 서버가 한다.
 */
function reachableAreas(permissions) {
  const viewers = permissions?.viewerReach?.viewers;
  if (!Array.isArray(viewers)) return new Map();
  const found = new Map();
  for (const viewer of viewers) {
    if (typeof viewer?.key !== "string" || !Array.isArray(viewer.reaches)) continue;
    if (viewer.reaches.length === 0) continue; // 전부에 닿는다 — 여기서 재지 않는다
    found.set(viewer.key, new Set(viewer.reaches));
  }
  return found;
}

/** 화면이 이름을 불러 쓰는 출처·변이. 어디에 적히든 찾는다. */
const NAMED_SOURCE_PROPS = new Set([
  "dataSourceKey",
  "poolSourceKey",
  "downloadSourceKey",
  "copySourceKey",
  "mutationKey"
]);

function namedSourcesOf(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) namedSourcesOf(item, found);
    return found;
  }
  if (!isObject(node)) return found;
  for (const [property, value] of Object.entries(node)) {
    if (NAMED_SOURCE_PROPS.has(property) && typeof value === "string") found.add(value);
    // 선택지는 이름만이 아니라 인자까지 실어서 한 덩어리로 적힌다.
    if (property === "optionsSource" && isObject(value) && typeof value.key === "string") {
      found.add(value.key);
    }
    namedSourcesOf(value, found);
  }
  return found;
}

function checkViewerReach(findings, screens, groups, permissions) {
  const reachableByViewer = reachableAreas(permissions);
  const areaOf = new Map();
  for (const [items] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      if (typeof item?.key === "string") areaOf.set(item.key, item?.authorize?.area);
    }
  }
  for (const screen of Array.isArray(screens) ? screens : []) {
    const viewer = screen?.spec?.viewer;
    const reachable = reachableByViewer.get(viewer);
    if (reachable === undefined) continue;
    for (const key of [...namedSourcesOf(screen.spec)].sort()) {
      const area = areaOf.get(key);
      // 카탈로그에 없는 이름은 다른 검사가 잡는다. 여기서 두 번 말하지 않는다.
      if (area === undefined || reachable.has(area)) continue;
      findings.push({
        level: "error",
        file: screen.file,
        message:
          `'${viewer}'가 보는 화면인데 '${key}'가 '${area}'를 요구합니다. ` +
          `이 화면을 여는 사람은 [${[...reachable].join(", ")}]에만 닿습니다.`
      });
    }
  }
}

/**
 * 자리마다 매단 권한 영역이 실제로 있는가, 그리고 **판정할 수 있는가.**
 *
 * 조건이 대상을 요구하는데 그 대상을 가리키는 인자가 자리에 없으면, 그 조건은
 * 판정할 수가 없다 — 그러면 서버는 막거나 열거나 둘 중 하나를 **짐작으로** 하게 된다.
 */
function checkAuthorize(findings, permissions, groups) {
  if (!isObject(permissions)) return;
  const areas = new Map(
    (Array.isArray(permissions.areas) ? permissions.areas : []).map((area) => [area?.key, area])
  );
  const needsOf = new Map(
    (Array.isArray(permissions.conditions) ? permissions.conditions : [])
      .map((condition) => [condition?.key, condition?.needs])
  );

  for (const [items, what, file] of groups) {
    for (const item of Array.isArray(items) ? items : []) {
      const authorize = item?.authorize;
      if (!isObject(authorize)) continue;
      const area = areas.get(authorize.area);
      if (area === undefined) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${item.key}'가 없는 권한 영역 '${authorize.area}'를 가리킵니다.`
        });
        continue;
      }
      const needs = [
        ...new Set(
          Object.values(isObject(area.rules) ? area.rules : {})
            .map((rule) => needsOf.get(rule?.when))
            .filter((need) => typeof need === "string" && need !== "viewer")
        )
      ];
      if (needs.length === 0) {
        if (typeof authorize.object === "string") {
          findings.push({
            level: "error",
            file,
            message: `${what} '${item.key}'의 권한 영역 '${area.key}'는 대상이 필요 없는데 object를 적었습니다.`
          });
        }
        continue;
      }
      if (typeof authorize.object !== "string") {
        findings.push({
          level: "warning",
          file,
          message: `${what} '${item.key}'의 권한 영역 '${area.key}'는 ${needs.join("·")}을 보고 판정하는데, 그 대상을 가리키는 인자가 이 자리에 없습니다 — 조건을 판정할 수 없습니다.`
        });
        continue;
      }
      const declared = paramKeys(item);
      if (!declared.has(authorize.object)) {
        findings.push({
          level: "error",
          file,
          message: `${what} '${item.key}'가 권한 대상으로 가리킨 인자 '${authorize.object}'가 이 자리에 선언돼 있지 않습니다.`
        });
      }
    }
  }
}

/**
 * 권한 명세와 API·화면의 권한 연결을 검사한다. 입력을 바꾸지 않고 결과를 반환한다.
 * groups는 [카탈로그 항목 목록, 진단에 쓸 이름, 파일 경로]의 목록이다.
 */
export function collectPermissionFindings({
  permissions = null,
  permissionsFile = "permissions.json",
  screens = [],
  groups = []
} = {}) {
  const findings = [];
  checkPermissions(findings, permissions, permissionsFile);
  checkAuthorize(findings, permissions, groups);
  checkSecretDeclared(findings, permissions, groups);
  checkViewerReach(findings, screens, groups, permissions);
  return findings;
}
