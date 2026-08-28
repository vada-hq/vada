import type {
  ButtonAction,
  ScreenElement,
  ButtonEmphasis,
  ButtonSpec,
  InputSpec,
  ScreenSpec,
  SelectSpec,
} from './types'
import { readObjectSource } from '../data-sources/catalog'
import { resolveParams } from './params'
import { workspaceOf } from './workspaces'
import onb01Json from '../../../../specs/figma/vada-wireframe/screens/ONB-01/screen.json'
import onb02Json from '../../../../specs/figma/vada-wireframe/screens/ONB-02/screen.json'
import org01Json from '../../../../specs/figma/vada-wireframe/screens/ORG-01/screen.json'
import org00Json from '../../../../specs/figma/vada-wireframe/screens/ORG-00/screen.json'
import org02Json from '../../../../specs/figma/vada-wireframe/screens/ORG-02/screen.json'
import org03aJson from '../../../../specs/figma/vada-wireframe/screens/ORG-03A/screen.json'
import org03bJson from '../../../../specs/figma/vada-wireframe/screens/ORG-03B/screen.json'
import org03cJson from '../../../../specs/figma/vada-wireframe/screens/ORG-03C/screen.json'
import org04Json from '../../../../specs/figma/vada-wireframe/screens/ORG-04/screen.json'
import org04bJson from '../../../../specs/figma/vada-wireframe/screens/ORG-04B/screen.json'
import org07aJson from '../../../../specs/figma/vada-wireframe/screens/ORG-07A/screen.json'
import org07bJson from '../../../../specs/figma/vada-wireframe/screens/ORG-07B/screen.json'
import org07cJson from '../../../../specs/figma/vada-wireframe/screens/ORG-07C/screen.json'
import inv01Json from '../../../../specs/figma/vada-wireframe/screens/INV-01/screen.json'
import home01kJson from '../../../../specs/figma/vada-wireframe/screens/HOME-01K/screen.json'
import my01Json from '../../../../specs/figma/vada-wireframe/screens/MY-01/screen.json'
import ops00Json from '../../../../specs/figma/vada-wireframe/screens/OPS-00/screen.json'
import task01Json from '../../../../specs/figma/vada-wireframe/screens/TASK-01/screen.json'
import opsMeet01aJson from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-01A/screen.json'
import opsMeet02Json from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-02/screen.json'
import opsMeet03aJson from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-03A/screen.json'
import opsMeet04bJson from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-04B/screen.json'
import opsMeet05aJson from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-05A/screen.json'
import opsMeet09Json from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-09/screen.json'
import opsMeetD01Json from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-D01/screen.json'
import opsMeetD04Json from '../../../../specs/figma/vada-wireframe/screens/OPS-MEET-D04/screen.json'
import evt00aJson from '../../../../specs/figma/vada-wireframe/screens/EVT-00A/screen.json'
import evt02Json from '../../../../specs/figma/vada-wireframe/screens/EVT-02/screen.json'
import evtTask01Json from '../../../../specs/figma/vada-wireframe/screens/EVT-TASK-01/screen.json'
import evtTask02Json from '../../../../specs/figma/vada-wireframe/screens/EVT-TASK-02/screen.json'
import evtDoc01Json from '../../../../specs/figma/vada-wireframe/screens/EVT-DOC-01/screen.json'
import evtMeet01Json from '../../../../specs/figma/vada-wireframe/screens/EVT-MEET-01/screen.json'
import evtSched01Json from '../../../../specs/figma/vada-wireframe/screens/EVT-SCHED-01/screen.json'
import evt04Json from '../../../../specs/figma/vada-wireframe/screens/EVT-04/screen.json'
import evtFin01Json from '../../../../specs/figma/vada-wireframe/screens/EVT-FIN-01/screen.json'
import finReq01Json from '../../../../specs/figma/vada-wireframe/screens/FIN-REQ-01/screen.json'
import finReq02Json from '../../../../specs/figma/vada-wireframe/screens/FIN-REQ-02/screen.json'
import myReq01Json from '../../../../specs/figma/vada-wireframe/screens/MY-REQ-01/screen.json'
import finSup01Json from '../../../../specs/figma/vada-wireframe/screens/FIN-SUP-01/screen.json'
import finRev01Json from '../../../../specs/figma/vada-wireframe/screens/FIN-REV-01/screen.json'
import finEvid01Json from '../../../../specs/figma/vada-wireframe/screens/FIN-EVID-01/screen.json'
import finProc01Json from '../../../../specs/figma/vada-wireframe/screens/FIN-PROC-01/screen.json'

// 스펙 JSON 드리프트가 조용한 오동작 대신 명확한 오류로 드러나게 하는 최소
// 런타임 가드다. 깊은 검증은 파이프라인 검증 CLI(validate-specs)가 담당한다.
export function asScreenSpec(json: unknown): ScreenSpec {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('화면 JSON은 객체여야 합니다.')
  }
  const record = json as Record<string, unknown>
  if (typeof record.screenId !== 'string' || record.screenId.length === 0) {
    throw new Error('화면 JSON에 screenId가 필요합니다.')
  }
  if (!Array.isArray(record.elements)) {
    throw new Error(`화면 ${record.screenId}의 elements는 배열이어야 합니다.`)
  }
  return json as ScreenSpec
}

export const onb01 = asScreenSpec(onb01Json)
export const onb02 = asScreenSpec(onb02Json)
export const org01 = asScreenSpec(org01Json)
export const org00 = asScreenSpec(org00Json)
export const org02 = asScreenSpec(org02Json)
export const org03a = asScreenSpec(org03aJson)
export const org03b = asScreenSpec(org03bJson)
export const org03c = asScreenSpec(org03cJson)
export const org04 = asScreenSpec(org04Json)
export const org04b = asScreenSpec(org04bJson)
export const org07a = asScreenSpec(org07aJson)
export const org07b = asScreenSpec(org07bJson)
export const org07c = asScreenSpec(org07cJson)
export const inv01 = asScreenSpec(inv01Json)
export const home01k = asScreenSpec(home01kJson)
export const my01 = asScreenSpec(my01Json)
export const ops00 = asScreenSpec(ops00Json)
export const task01 = asScreenSpec(task01Json)
export const opsMeet01a = asScreenSpec(opsMeet01aJson)
export const opsMeet02 = asScreenSpec(opsMeet02Json)
export const opsMeet03a = asScreenSpec(opsMeet03aJson)
export const opsMeet04b = asScreenSpec(opsMeet04bJson)
export const opsMeet05a = asScreenSpec(opsMeet05aJson)
export const opsMeet09 = asScreenSpec(opsMeet09Json)
export const opsMeetD01 = asScreenSpec(opsMeetD01Json)
export const opsMeetD04 = asScreenSpec(opsMeetD04Json)
export const evt00a = asScreenSpec(evt00aJson)
export const evt02 = asScreenSpec(evt02Json)
export const evtTask01 = asScreenSpec(evtTask01Json)
export const evtTask02 = asScreenSpec(evtTask02Json)
export const evtDoc01 = asScreenSpec(evtDoc01Json)
export const evtMeet01 = asScreenSpec(evtMeet01Json)
export const evtSched01 = asScreenSpec(evtSched01Json)
export const evt04 = asScreenSpec(evt04Json)
export const evtFin01 = asScreenSpec(evtFin01Json)
export const finReq01 = asScreenSpec(finReq01Json)
export const finReq02 = asScreenSpec(finReq02Json)
export const myReq01 = asScreenSpec(myReq01Json)
export const finSup01 = asScreenSpec(finSup01Json)
export const finRev01 = asScreenSpec(finRev01Json)
export const finEvid01 = asScreenSpec(finEvid01Json)
export const finProc01 = asScreenSpec(finProc01Json)

// 구현에 등록된 화면 전부. 화면 목록을 따로 선언하지 않고 이미 등록된 것을 모은다.
// ScreenRouter가 아는 것과 어긋나면 element-type-registry처럼 검사로 막아야 하지만,
// 지금은 이 배열과 라우터가 같은 파일 묶음 안에 있어 한눈에 보인다.
export const ALL_SCREENS: ScreenSpec[] = [
  onb01,
  onb02,
  inv01,
  org01,
  org00,
  org02,
  org03a,
  org03b,
  org03c,
  org04,
  org04b,
  org07a,
  org07b,
  org07c,
  home01k,
  my01,
  ops00,
  task01,
  opsMeet01a,
  opsMeet02,
  opsMeet03a,
  opsMeet04b,
  opsMeet05a,
  opsMeet09,
  opsMeetD01,
  opsMeetD04,
  evt00a,
  evt02,
  evtTask01,
  evtTask02,
  evtDoc01,
  evtMeet01,
  evtSched01,
  evt04,
  evtFin01,
  finReq01,
  finReq02,
  myReq01,
  finSup01,
  finRev01,
  finEvid01,
  finProc01,
]

// 화면 하나만 열어 볼 때 넘길 인자.
//
// 상세 화면은 "무엇의 상세인지"를 밖에서 받는다. 검사는 앞 화면을 거치지 않고
// 화면을 바로 그리므로 그 값을 어디선가 얻어야 하는데, 검사가 지어내면 그것은
// 명세에 없는 사실이 된다. 그래서 **명세가 예시 값을 들고 있고**(params[].example)
// 검사는 그것을 읽기만 한다. 구현은 이 값을 쓰지 않는다 — 인자가 없으면
// 조용히 아무거나 보여주는 대신 드러내야 한다.
export function exampleParamsOf(screenId: string): Record<string, string> {
  const screen = ALL_SCREENS.find((candidate) => candidate.screenId === screenId)
  return Object.fromEntries(
    (screen?.params ?? [])
      .filter((param) => param.example !== undefined)
      .map((param) => [param.key, param.example as string]),
  )
}

// 화면에 그려지는 제목.
//
// meta.title은 **화면의 이름**이다. 대개 그것이 그대로 제목으로 그려지지만,
// 무엇의 화면인지가 곧 제목인 자리가 있다 — 행사 업무 보드의 제목은 그 행사의
// 이름이고, 이름은 데이터에만 있다. 그럴 때 meta.titleFrom이 어디서 읽을지를
// 말하고, meta.title은 사람이 이 화면을 부르는 말로 남는다.
//
// 화면과 준수 검사가 같은 함수를 본다 — 두 곳에 적으면 언젠가 갈린다.
export function drawnTitleOf(
  screen: ScreenSpec,
  screenParams: Record<string, string> = {},
): string {
  // 작업 공간에 속하면 그 공간의 이름이 곧 제목이다 — 행사 개요의 제목도 행사
  // 업무 보드의 제목도 그 행사의 이름이다. 화면이 따로 정했으면 그것이 이긴다.
  //
  // 다만 **자기 아래에 다시 여러 화면을 거느리는 입구는 자기 이름을 앞세운다**
  // (EVT-FIN-01은 구매 요청·처리·증빙의 입구라 제목이 '행사 재정 — 개요'다).
  // 어느 쪽인지는 디자인이 말하고 명세가 workspace.ownTitle로 옮겨 적는다.
  const workspace = workspaceOf(screen)
  if (screen.workspace?.ownTitle === true) {
    return screen.meta?.title ?? screen.screenId
  }
  const from = screen.meta?.titleFrom ?? workspace?.titleFrom
  if (from === undefined) {
    return screen.meta?.title ?? screen.screenId
  }
  const params =
    screen.meta?.titleFrom !== undefined
      ? resolveParams(screen.meta.titleFrom.params, { screenParams })
      : { [workspace!.param]: screenParams[workspace!.param] ?? '' }
  return String(readObjectSource(from.dataSourceKey, params)[from.field])
}

// meta.title이 화면에 그려지기를 기대할 수 있는가.
//
// 예전에는 화면 이름을 손으로 적은 목록이었다. 이제 대부분은 규칙으로 답한다 —
// **제목이 데이터에서 오면 meta.title은 화면을 부르는 말일 뿐이다.** 행사 개요의
// 제목은 그 행사의 이름이고, `행사 개요`는 어디에도 그려지지 않는다. 그리는 자리가
// 따로 있는 화면도 있지만(EVT-TASK-01은 보드의 머리에 그린다) 그것은 화면의 선택이라
// 기대로 삼지 않는다.
//
// 규칙으로 답할 수 없는 것이 하나 남았다: INV-01의 design(14:1)에는 화면 제목이
// 아예 없고 그 자리를 요약 카드가 대신한다. 데이터에서 오는 것도 아니다.
const TITLE_NOT_DRAWN = new Set(['INV-01'])

export function drawsTitle(screen: ScreenSpec): boolean {
  if (TITLE_NOT_DRAWN.has(screen.screenId)) {
    return false
  }
  // 자기 이름을 앞세우는 입구는 제목이 곧 meta.title이다.
  if (screen.workspace?.ownTitle === true) {
    return true
  }
  return screen.meta?.titleFrom === undefined && workspaceOf(screen)?.titleFrom === undefined
}

// 배치가 명세에 없는 화면(대시보드)은 구현이 design의 자리마다 요소를 끼운다.
// nodeId로 찾는다 — 라벨은 화면 안에서 유일하지 않을 수 있지만 nodeId는 유일하다.
export function elementByNodeId(screen: ScreenSpec, nodeId: string): ScreenElement {
  const found = screen.elements.find((element) => element.source.nodeId === nodeId)
  if (!found) {
    throw new Error(`화면 ${screen.screenId}에 nodeId ${nodeId}인 요소가 없습니다.`)
  }
  return found
}

// 화면이 어느 요소를 어디에 그렸는지 design 대조에 알리는 끈(data-node-id)의 값.
//
// 따로 적어 두지 않는다 — 화면은 이미 명세의 spec 객체를 손에 들고 있으므로, 그
// 객체가 어느 등록 노드에서 왔는지는 명세가 답할 수 있다. 화면이 nodeId를 손으로
// 적으면 그 순간 두 번째 진실이 생긴다.
export function nodeIdOf(screen: ScreenSpec, spec: ScreenElement['spec']): string {
  const found = screen.elements.find((element) => element.spec === spec)
  if (!found) {
    throw new Error(`화면 ${screen.screenId}에 등록되지 않은 요소입니다.`)
  }
  return found.source.nodeId
}

export function findInputSpec(screen: ScreenSpec, fieldKey: string): InputSpec {
  for (const element of screen.elements) {
    if (element.spec.type === 'input' && element.spec.fieldKey === fieldKey) {
      return element.spec
    }
  }
  throw new Error(`화면 ${screen.screenId}에 input ${fieldKey}가 없습니다.`)
}

export function findSelectSpec(screen: ScreenSpec, fieldKey: string): SelectSpec {
  for (const element of screen.elements) {
    if (element.spec.type === 'select' && element.spec.fieldKey === fieldKey) {
      return element.spec
    }
  }
  throw new Error(`화면 ${screen.screenId}에 select ${fieldKey}가 없습니다.`)
}

// navigate 버튼의 이동 대상. submit 버튼은 onSuccess로 이동하므로 여기서 다루지 않는다.
// 조용한 대체 대신 명확한 오류를 낸다(내비게이션 계약과 같은 태도).
export function navigateTarget(action: ButtonAction): string {
  if (action.type !== 'navigate') {
    throw new Error(`navigate 버튼이 아닙니다: action.type=${action.type}`)
  }
  return action.targetScreenId
}

export function findButtonSpec(screen: ScreenSpec, label?: string): ButtonSpec {
  for (const element of screen.elements) {
    if (element.spec.type === 'button' && (!label || element.spec.label === label)) {
      return element.spec
    }
  }
  throw new Error(`화면 ${screen.screenId}에 버튼${label ? ` '${label}'` : ''}이 없습니다.`)
}

// 강조도로 버튼을 고른다. 예전에는 배열 위치(마지막이 주 버튼)나 흐름 순서로
// 추측했는데, 흐름을 넘는 이동에서는 무력했다. 이제 명세가 직접 말한다.
// 없으면 조용히 대체하지 않고 오류를 낸다 — 명세 구멍을 숨기지 않는다.
export function buttonsByEmphasis(
  buttons: ButtonSpec[],
  emphasis: ButtonEmphasis,
): ButtonSpec[] {
  return buttons.filter((button) => button.emphasis === emphasis)
}

export function primaryButtonOf(buttons: ButtonSpec[]): ButtonSpec {
  const found = buttonsByEmphasis(buttons, 'primary')
  if (found.length !== 1) {
    throw new Error(
      `주 버튼이 정확히 하나여야 하는데 ${found.length}개입니다. 화면 JSON의 emphasis를 확인하세요.`,
    )
  }
  return found[0]
}
