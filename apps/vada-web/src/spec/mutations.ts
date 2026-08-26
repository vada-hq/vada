// specs/figma/vada-wireframe/mutations.json 카탈로그의 소비자.
// 계약(경로·payload 스코프·상태 문구)은 카탈로그를 단일 원본으로 읽고,
// 네트워크만 개발용 mock으로 대체한다(로딩 상태 확인용 인위 지연 포함).
import catalogJson from '../../../../specs/figma/vada-wireframe/mutations.json'

export interface Mutation {
  key: string
  description: string
  request: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }
  payloadScope: string
  messages: { submitting: string; error: string }
}

// 카탈로그 드리프트가 조용한 오동작 대신 명확한 오류로 드러나게 하는 최소 가드다.
export function asMutationCatalog(json: unknown): { mutations: Mutation[] } {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('제출 카탈로그는 객체여야 합니다.')
  }
  const mutations = (json as Record<string, unknown>).mutations
  if (!Array.isArray(mutations)) {
    throw new Error('제출 카탈로그에 mutations 배열이 필요합니다.')
  }
  for (const mutation of mutations as Mutation[]) {
    if (typeof mutation?.key !== 'string' || !mutation.key) {
      throw new Error('제출 계약에 key가 필요합니다.')
    }
    if (!mutation.request?.method || !mutation.request?.path) {
      throw new Error(`'${mutation.key}'에 request.method와 request.path가 필요합니다.`)
    }
    if (mutation.payloadScope !== undefined && !mutation.payloadScope) {
      throw new Error(`'${mutation.key}'의 payloadScope가 비었습니다. 없으면 아예 적지 않습니다.`)
    }
  }
  return { mutations: mutations as Mutation[] }
}

const byKey = new Map(asMutationCatalog(catalogJson).mutations.map((m) => [m.key, m]))

export function getMutation(key: string): Mutation {
  const mutation = byKey.get(key)
  if (!mutation) {
    throw new Error(`제출 계약 '${key}'가 카탈로그에 없습니다.`)
  }
  return mutation
}

// vada-conventions 7번: mock에 인위 지연을 둬 로딩 상태를 실제로 확인한다.
const MOCK_DELAY_MS = 450

export async function runMutation(key: string, payload: unknown): Promise<void> {
  getMutation(key)
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  // 개발 mock: 실제 전송 없이 성공으로 처리한다. 백엔드 연동 시 여기만 바꾼다.
  void payload
}
