import type {
  ButtonAction,
  ButtonEmphasis,
  ButtonSpec,
  InputSpec,
  ScreenSpec,
  SelectSpec,
} from './types'
import onb01Json from '../../../../specs/figma/vada-wireframe/screens/ONB-01/screen.json'
import onb02Json from '../../../../specs/figma/vada-wireframe/screens/ONB-02/screen.json'
import org01Json from '../../../../specs/figma/vada-wireframe/screens/ORG-01/screen.json'
import org02Json from '../../../../specs/figma/vada-wireframe/screens/ORG-02/screen.json'
import inv01Json from '../../../../specs/figma/vada-wireframe/screens/INV-01/screen.json'

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
export const org02 = asScreenSpec(org02Json)
export const inv01 = asScreenSpec(inv01Json)

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
