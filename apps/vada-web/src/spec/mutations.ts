// specs/figma/vada-wireframe/mutations.json 카탈로그의 소비자.
import type { DataRow } from '../data-sources/catalog'
// 계약(경로·payload 스코프·상태 문구)은 카탈로그를 단일 원본으로 읽고,
// 네트워크만 개발용 mock으로 대체한다(로딩 상태 확인용 인위 지연 포함).
import catalogJson from '../../../../specs/figma/vada-wireframe/mutations.json'
import { currentServer, forgetSources, urlOf } from '../data-sources/server'
import { isServedMutation } from '../data-sources/served'

export interface Mutation {
  key: string
  description: string
  request: { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }
  /** 자리가 실어 가는 인자. 무엇의 것인지를 이것이 말한다. */
  params: Array<{ key: string; required: boolean; valueType: string; description: string }>
  payloadScope: string
  /** 두 번 보내면 어떻게 되는가. 계약이 정한다 — 화면이 짐작하지 않는다. */
  repeat?: { kind: string; why: string }
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

/**
 * **아직 서버에 붙지 않은 자리.**
 *
 * 서버가 고장 난 것과 **아직 안 만든 것**은 다른 일이다. 같은 글로 말하면 남은 흐름을
 * 붙이는 동안 어느 쪽인지 매번 코드를 읽어야 하고, 사람에게도 '고쳐질 것'과 '아직 없는 것'이
 * 구분되지 않는다.
 *
 * 어느 것이 붙었는지는 `served.ts`가 든다 — 그 목록이 진도표다.
 */
export class NotServedYet extends Error {
  readonly key: string

  constructor(key: string) {
    super(`'${key}'는 아직 서버에 붙지 않았습니다.`)
    this.name = 'NotServedYet'
    this.key = key
  }
}

export async function runMutation(
  key: string,
  payload: unknown,
  params: Record<string, string> = {},
): Promise<DataRow> {
  const mutation = getMutation(key)

  // **자리가 실어 가는 것을 빠뜨리지 않는다.** 계약이 인자를 필수라 했는데 넘기지
  // 않으면 서버는 누구의 것인지 모른다 — 개발용 대역이라도 그 사실이 드러나야 한다.
  for (const param of mutation.params ?? []) {
    if (param.required && params[param.key] === undefined) {
      throw new Error(`제출 계약 '${key}'는 인자 '${param.key}'를 반드시 받습니다(${param.description}).`)
    }
  }

  // **서버에 붙어 있는 동안은 성공한 척하지 않는다.**
  //
  // 오늘 가장 비쌌던 결함이 여기 있었다 — 아무 데도 안 보내고 무조건 성공을 돌려줘서,
  // '조직 만들기'를 누르면 학생회가 안 생기는데 다음 화면으로 넘어갔다. 목록에서 한 줄만
  // 빠져도 같은 일이 다시 난다.
  //
  // 그래서 켜져 있으면 둘 중 하나다: **보내거나, 못 보낸다고 말하거나.**
  // 대역이 답하는 것은 서버를 아예 안 켠 동안(검사·개발)뿐이다.
  if (currentServer() !== null) {
    if (!isServedMutation(key)) throw new NotServedYet(key)
    return sendMutation(mutation, payload, params)
  }

  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  // 개발 대역: 실제 전송 없이 성공으로 처리한다. 무엇이 진짜로 나가는지는 SERVED_MUTATIONS가 든다.
  void payload
  return MUTATION_RESULTS[key] ?? {}
}

/**
 * 계약이 되풀이를 막으라 한 자리에 다는 열쇠.
 *
 * **부를 때마다 새것이다.** 같은 값을 다시 쓰면 서버가 '아까 그 요청'으로 보고 아무
 * 일도 안 한다 — 사람이 학생회를 둘째로 만들려 할 때 조용히 안 만들어진다. 다시
 * 보내기(재시도)는 아직 없으므로 한 번 누름이 곧 한 번 보냄이다.
 */
function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/**
 * 서버로 보낸다.
 *
 * **실패하면 던진다.** 개발용 대역으로 슬쩍 돌아가면 아무 일도 안 일어났는데 다음
 * 화면으로 넘어간다 — 실제로 그랬다. 부르는 쪽(`useSubmitAction`)이 이 오류를 받아
 * 카탈로그의 글을 그리고 **이동하지 않는다.**
 */
async function sendMutation(
  mutation: Mutation,
  payload: unknown,
  params: Record<string, string>,
): Promise<DataRow> {
  const at = currentServer()!
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  // 계약이 되풀이를 어떻게 다루는지 적어 두었다. 키를 요구하는 자리에 안 달면 422다.
  if (mutation.repeat?.kind === 'idempotencyKey') {
    headers['Idempotency-Key'] = newIdempotencyKey()
  }
  const res = await at.fetch(`${at.baseUrl ?? ''}${urlOf(mutation.request.path, params)}`, {
    method: mutation.request.method,
    headers,
    body: JSON.stringify(payload ?? {}),
  })
  if (!res.ok) {
    throw new Error(`제출 '${mutation.key}'가 실패했습니다(${res.status}).`)
  }
  // **쓰고 나면 받아 둔 것을 잊는다.** 그러지 않으면 저장소는 바뀌었는데 화면은
  // 앞서 받아 둔 것을 그대로 그린다 — 초대 코드를 다시 만들고도 옛 코드를 보여
  // 주는 자리가 실제로 그랬다. 실패한 쓰기에는 잊을 것이 없다.
  forgetSources()
  // 답이 없는 자리도 있다(계약이 '돌려주는 값이 없다'고 적은 것).
  const text = await res.text()
  return text === '' ? {} : (JSON.parse(text) as DataRow)
}
