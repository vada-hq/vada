import type { ButtonSpec, InputSpec, ScreenSpec, SelectSpec } from './types'
import onb01Json from '../../../../specs/figma/vada-wireframe/screens/ONB-01.json'
import onb02Json from '../../../../specs/figma/vada-wireframe/screens/ONB-02.json'

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

export function findButtonSpec(screen: ScreenSpec, label?: string): ButtonSpec {
  for (const element of screen.elements) {
    if (element.spec.type === 'button' && (!label || element.spec.label === label)) {
      return element.spec
    }
  }
  throw new Error(`화면 ${screen.screenId}에 버튼${label ? ` '${label}'` : ''}이 없습니다.`)
}
