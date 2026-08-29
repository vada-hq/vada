// specs/figma/vada-wireframe/mutations.json 카탈로그의 소비자.
import type { DataRow } from '../data-sources/catalog'
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

/**
 * 보내고 나면 서버가 답을 준다. **만든 것의 id가 그 답에만 있다.**
 *
 * 개발용 응답은 mutations.json이 아니라 여기 있다 — 카탈로그는 계약(경로·상태
 * 문구)을 갖고, 무엇이 돌아오는지는 서버 대역이 정한다.
 */
const MUTATION_RESULTS: Record<string, DataRow> = {
  'message.room.create': { id: 'MR-01' },
  // **사람마다 다른 영수증.** QR·링크의 토큰으로 결과를 조회하면 같은 것을 쓴
  // 여러 사람이 서로의 이름과 결과를 본다 — 개발용 응답에서도 그 사실을 지킨다.
  //
  // 진짜 서버는 추측할 수 없는 값을 만들고 해시로 저장한다. 여기서는 어느 결과로
  // 이어지는지가 보여야 하므로 그 결과의 토큰을 붙여 둔다.
  'attendance.checkIn': { receiptToken: 'RCPT-B3N8P4' },
  'survey.apply': { receiptToken: 'RCPT-SVY-4f2a91c7' },
}

export async function runMutation(key: string, payload: unknown): Promise<DataRow> {
  getMutation(key)
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  // 개발 mock: 실제 전송 없이 성공으로 처리한다. 백엔드 연동 시 여기만 바꾼다.
  void payload
  return MUTATION_RESULTS[key] ?? {}
}
