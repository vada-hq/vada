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

/**
 * 명세 폴더에 있는 화면 전부. **빌드가 폴더를 걸어 모은다.**
 *
 * 손으로 적으면 빠뜨리고, 빠뜨린 것은 조용하다 — 화면이 안 그려지는 것이 아니라
 * 검사가 그 화면을 안 도는 것이라 아무 데서도 붉어지지 않는다.
 */
const SCREEN_JSON = import.meta.glob<{ default: unknown }>(
  '../../../../specs/figma/vada-wireframe/screens/*/screen.json',
  { eager: true },
)

const BY_ID = new Map<string, ScreenSpec>(
  Object.entries(SCREEN_JSON).map(([path, module]) => {
    const spec = asScreenSpec(module.default)
    // 폴더 이름과 screenId가 갈리면 어느 쪽이 참인지 알 수 없다. 검증기도 보지만
    // 여기서 먼저 멈춘다 — 이 지도가 틀리면 아래 전부가 틀린다.
    const folder = path.split('/').at(-2)
    if (folder !== spec.screenId) {
      throw new Error(`화면 폴더 '${folder}'와 screenId '${spec.screenId}'가 다릅니다.`)
    }
    return [spec.screenId, spec]
  }),
)

/** 그 화면의 명세. **없으면 던진다** — 없는 화면을 조용히 지나가면 빈 것이 그려진다. */
export function screenOf(screenId: string): ScreenSpec {
  const spec = BY_ID.get(screenId)
  if (spec === undefined) {
    throw new Error(`화면 '${screenId}'의 명세가 없습니다.`)
  }
  return spec
}

export const onb01 = screenOf('ONB-01')
export const onb02 = screenOf('ONB-02')
export const org01 = screenOf('ORG-01')
export const org00 = screenOf('ORG-00')
export const org02 = screenOf('ORG-02')
export const org03a = screenOf('ORG-03A')
export const org03b = screenOf('ORG-03B')
export const org03c = screenOf('ORG-03C')
export const org04 = screenOf('ORG-04')
export const org04b = screenOf('ORG-04B')
export const org07a = screenOf('ORG-07A')
export const org07b = screenOf('ORG-07B')
export const org07c = screenOf('ORG-07C')
export const inv00 = screenOf('INV-00')
export const inv01 = screenOf('INV-01')
export const opsCal01 = screenOf('OPS-CAL-01')
export const home01k = screenOf('HOME-01K')
export const my01 = screenOf('MY-01')
export const ops00 = screenOf('OPS-00')
export const task01 = screenOf('TASK-01')
export const opsMeet01a = screenOf('OPS-MEET-01A')
export const opsMeet01c = screenOf('OPS-MEET-01C')
export const opsMeet02 = screenOf('OPS-MEET-02')
export const opsMeet03a = screenOf('OPS-MEET-03A')
export const opsMeet03b = screenOf('OPS-MEET-03B')
export const opsMeet03c = screenOf('OPS-MEET-03C')
export const opsMeet04b = screenOf('OPS-MEET-04B')
export const opsMeet05a = screenOf('OPS-MEET-05A')
export const opsMeet05b = screenOf('OPS-MEET-05B')
export const opsMeet06a = screenOf('OPS-MEET-06A')
export const opsMeet06b = screenOf('OPS-MEET-06B')
export const opsMeet07 = screenOf('OPS-MEET-07')
export const opsMeet08 = screenOf('OPS-MEET-08')
export const opsMeet09 = screenOf('OPS-MEET-09')
export const opsMeetD01 = screenOf('OPS-MEET-D01')
export const opsMeetD02 = screenOf('OPS-MEET-D02')
export const opsMeetD03 = screenOf('OPS-MEET-D03')
export const opsMeetD04 = screenOf('OPS-MEET-D04')
export const evt00a = screenOf('EVT-00A')
export const evt00a2 = screenOf('EVT-00A2')
export const evt02 = screenOf('EVT-02')
export const evt00b = screenOf('EVT-00B')
export const evt01 = screenOf('EVT-01')
export const evt02b = screenOf('EVT-02B')
export const evt02c = screenOf('EVT-02C')
export const evt02d = screenOf('EVT-02D')
export const evt02e = screenOf('EVT-02E')
export const evt03a = screenOf('EVT-03A')
export const evt03b = screenOf('EVT-03B')
export const evt04b = screenOf('EVT-04B')
export const evtTask01 = screenOf('EVT-TASK-01')
export const evtTask02 = screenOf('EVT-TASK-02')
export const evtDoc01 = screenOf('EVT-DOC-01')
export const evtMeet01 = screenOf('EVT-MEET-01')
export const evtSched01 = screenOf('EVT-SCHED-01')
export const evt04 = screenOf('EVT-04')
export const evt05 = screenOf('EVT-05')
export const evt05b = screenOf('EVT-05B')
export const evtFin01 = screenOf('EVT-FIN-01')
export const finReq01 = screenOf('FIN-REQ-01')
export const finReq02 = screenOf('FIN-REQ-02')
export const myReq01 = screenOf('MY-REQ-01')
export const finSup01 = screenOf('FIN-SUP-01')
export const finRev01 = screenOf('FIN-REV-01')
export const finEvid01 = screenOf('FIN-EVID-01')
export const fin00 = screenOf('FIN-00')
export const fin00b = screenOf('FIN-00B')
export const finLedger01 = screenOf('FIN-LEDGER-01')
export const finProc01 = screenOf('FIN-PROC-01')
export const msg01 = screenOf('MSG-01')
export const msg02 = screenOf('MSG-02')
export const msg03 = screenOf('MSG-03')
export const rec01 = screenOf('REC-01')
export const rec02 = screenOf('REC-02')
export const rec02a = screenOf('REC-02A')
export const ext01a = screenOf('EXT-01A')
export const ext01b = screenOf('EXT-01B')
export const ext02a = screenOf('EXT-02A')
export const ext02b = screenOf('EXT-02B')
export const ext02c = screenOf('EXT-02C')

/**
 * **화면 목록을 손으로 적지 않는다.**
 *
 * 오랫동안 여든 줄짜리 배열이었다. 주석은 "따로 선언하지 않고 이미 등록된 것을 모은다"고
 * 적혀 있었지만 바로 아래가 손으로 적은 배열이었고, **명세 여든넷 중 넷이 그 배열에서 빠진
 * 채 아무 검사에도 안 걸렸다**(EVT-03C · EVT-04C · OPS-MEET-01B · OPS-MEET-01D).
 * 준수 검사도 디자인 대조도 이 배열만 돌기 때문이다.
 *
 * ## 무엇이 제 주소를 갖는가는 명세가 이미 안다
 *
 * 손 목록을 지우면서 물었다 — 여든과 넷을 무엇으로 가르나. `variantOf`가 답이 아니었다:
 * 변형 열둘 중 여덟은 **원본과 다른 것을 그리므로** 제 화면이 있고 그 배열에 들어 있었다.
 *
 * 가르는 것은 **요소를 갖는가**다. 요소가 없으면 그릴 것이 없고, 그 모습은 원본이 데이터에
 * 따라 그린다(목록이 비었을 때, 다른 사람이 볼 때). 이 규칙이 옛 배열 여든을 **한 줄도
 * 틀리지 않고** 다시 만들어 낸다 — 사람이 적어 온 것을 명세가 이미 알고 있었다는 뜻이다.
 */

/** 명세에 있는 화면 전부. 변형까지 센다. */
export const ALL_SPEC_SCREENS: ScreenSpec[] = [...BY_ID.values()].sort((left, right) =>
  left.screenId.localeCompare(right.screenId),
)

/** 다른 화면의 한 때로 적힌 그림. 여덟은 제 것을 그리고 넷은 그리지 않는다. */
export const VARIANT_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.variantOf !== undefined,
)

/**
 * **원본이 데이터로 그리는 때.** 제 주소가 없다.
 *
 * 요소가 없으므로 더할 것이 없다 — 목록이 비었다는 말도, 그때 보이는 단추도 원본 화면의
 * `itemList`가 이미 갖고 있다. 주소를 따로 주면 같은 화면이 둘로 보인다.
 */
export const STATE_ONLY_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.elements.length === 0,
)

/** 제 주소를 갖는 화면. 준수 검사와 디자인 대조가 이것을 돈다. */
export const ALL_SCREENS: ScreenSpec[] = ALL_SPEC_SCREENS.filter(
  (screen) => screen.elements.length > 0,
)

// 화면 하나만 열어 볼 때 넘길 인자.
//
// 상세 화면은 "무엇의 상세인지"를 밖에서 받는다. 검사는 앞 화면을 거치지 않고
// 화면을 바로 그리므로 그 값을 어디선가 얻어야 하는데, 검사가 지어내면 그것은
// 명세에 없는 사실이 된다. 그래서 **명세가 예시 값을 들고 있고**(params[].example)
// 검사는 그것을 읽기만 한다. 구현은 이 값을 쓰지 않는다 — 인자가 없으면
// 조용히 아무거나 보여주는 대신 드러내야 한다.
export function exampleParamsOf(screenId: string): Record<string, string> {
  const screen = ALL_SPEC_SCREENS.find((candidate) => candidate.screenId === screenId)
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
  const found = screen.elements.find((element) => element.source?.nodeId === nodeId)
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
  return drawnNodeIdOf(found, screen.screenId)
}

/**
 * 이 요소를 그린 노드. **그림에 없는 요소에 물으면 던진다.**
 *
 * 조용히 빈 문자열을 주면 data-node-id가 빈 채로 붙고, 대조는 "끈이 없다"고만
 * 말한다 — 어느 요소가 왜 그런지는 안 나온다. 사람이 두기로 정한 요소
 * (addedByDecision)는 그린 노드가 없는 것이 정상이므로, 그 요소에 노드를 묻는
 * 코드가 잘못이다.
 */
export function drawnNodeIdOf(element: ScreenElement, screenId: string): string {
  if (element.source === undefined) {
    const decision = element.addedByDecision?.decision ?? '까닭이 적혀 있지 않음'
    throw new Error(
      `화면 ${screenId}: 그림에 없는 요소의 노드를 물었습니다(${decision}). ` +
        `사람이 두기로 정한 요소는 그린 노드가 없습니다.`,
    )
  }
  return element.source.nodeId
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
