import type {
  ButtonAction,
  ButtonEmphasis,
  ButtonSpec,
  InputSpec,
  ScreenElement,
  ScreenSpec,
  SelectSpec,
} from './types'

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
