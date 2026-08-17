import type { FlowsCatalog, FlowStep } from './types'
import flowsJson from '../../../../specs/figma/vada-wireframe/flows.json'

// 흐름 카탈로그의 최소 런타임 가드. 한 화면이 여러 흐름에 속하면 단계 표시가
// 모호해지므로 여기서도 거부한다(깊은 검증은 검증 CLI 담당).
export function asFlowsCatalog(json: unknown): FlowsCatalog {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('흐름 카탈로그는 객체여야 합니다.')
  }
  const flows = (json as Record<string, unknown>).flows
  if (!Array.isArray(flows)) {
    throw new Error('흐름 카탈로그에 flows 배열이 필요합니다.')
  }
  const seen = new Set<string>()
  for (const flow of flows as FlowsCatalog['flows']) {
    if (typeof flow?.key !== 'string' || typeof flow.label !== 'string') {
      throw new Error('흐름에 key와 label이 필요합니다.')
    }
    if (!Array.isArray(flow.screens) || flow.screens.length === 0) {
      throw new Error(`흐름 '${flow.key}'에 screens 배열이 필요합니다.`)
    }
    for (const screenId of flow.screens) {
      if (seen.has(screenId)) {
        throw new Error(`화면 '${screenId}'가 여러 흐름에 속합니다.`)
      }
      seen.add(screenId)
    }
  }
  return json as FlowsCatalog
}

const catalog = asFlowsCatalog(flowsJson)

// 단계 = 배열 위치+1, 전체 = 배열 길이. 흐름에 없는 화면은 null.
export function findFlowStep(screenId: string): FlowStep | null {
  for (const flow of catalog.flows) {
    const index = flow.screens.indexOf(screenId)
    if (index >= 0) {
      return { label: flow.label, step: index + 1, total: flow.screens.length }
    }
  }
  return null
}
