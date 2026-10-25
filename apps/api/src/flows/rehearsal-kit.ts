import { koreanDateOf, koreanOf } from '@vada/contracts'
import type { Person } from './people.js'
import type { Flow } from './server.js'

// 리허설 시나리오의 인물과 실행 중 알게 된 번호. 단계 파일들이 같이 쓴다.
export const ROLES = [
  'chief',
  'vice',
  'planHead',
  'planner',
  'financeHead',
  'financeStaff',
  'prHead',
] as const
export type Role = (typeof ROLES)[number]
export type Cast = Record<Role, Person>

export type Applicant = {
  name: string
  studentId: string
  commandId: string
  token: string
  // 같은 명령을 다시 보내기 전에 받은 토큰. 다시 보내면 닫힌다.
  staleToken: string | null
  id: string
}
type Ids = Record<'banner' | 'snack', string>

// 단계가 알게 된 번호. 앞 단계가 채우고 뒤 단계가 읽는다(상태를 바로 써 넣지 않고 응답에서 읽은 값만 둔다).
export type World = {
  councilId: string
  inviteCode: string
  memberIds: Record<Role, string>
  departmentIds: Record<'planning' | 'pr' | 'finance', string>
  accountIds: Record<'main' | 'fee', string>
  periodId: string
  budgetItemIds: Record<'event' | 'standing', string>
  eventId: string
  formId: string
  publicCode: string
  applicants: Applicant[]
  taskId: string
  messageId: string
  requestId: string
  lineItemIds: Ids
  expenseIds: Record<'request' | 'direct', string>
}
export const emptyWorld = (): World => ({
  councilId: '',
  inviteCode: '',
  memberIds: {} as World['memberIds'],
  departmentIds: { planning: '', pr: '', finance: '' },
  accountIds: { main: '', fee: '' },
  periodId: '',
  budgetItemIds: { event: '', standing: '' },
  eventId: '',
  formId: '',
  publicCode: '',
  applicants: [],
  taskId: '',
  messageId: '',
  requestId: '',
  lineItemIds: { banner: '', snack: '' },
  expenseIds: { request: '', direct: '' },
})

export type EvidenceUploader = (key: string) => void | Promise<void>
export type CouncilNames = { name: string; schoolName: string }

// 행사 하나의 모양. A는 끝난 행사, B는 앞으로 열릴 행사, C는 날짜 없는 행사다.
export type EventPlan = { name: string; schedule: 'ended' | 'upcoming' | 'tbd' }

export type Ctx = {
  flow: Flow
  cast: Cast
  w: World
  plan: EventPlan
  // 마지막 단계의 시각. 단계 시각은 여기서 거슬러 센다.
  finalAt: Date
  // 있으면 증빙을 올린 것으로 만든다(흐름 시험은 가짜 저장소에 두고, 시연은 실제 저장소에 올린다). 없으면 증빙 줄을 건너뛴다.
  uploadEvidence?: EvidenceUploader | undefined
  // 만들 학생회의 이름. 없으면 리허설 이름이다(시연은 학교 이름으로 이미 있는지 찾으므로 정해 준다).
  council?: CouncilNames | undefined
}

export const org = (ctx: Ctx) => `/api/organizations/${ctx.w.councilId}`
export const nowOf = (ctx: Ctx) => ctx.flow.driver.now()
export const koreanDay = (at: Date) => koreanDateOf(at)
export const koreanTime = (at: Date) => koreanOf(at)

// 응답이 기대한 상태이고 본문이 JSON이면 돌려주고, 아니면 어느 단계의 어떤 요청인지 알리며 던진다.
async function ok<T>(response: Response, step: string, status = 200): Promise<T> {
  if (response.status !== status)
    throw new Error(`${step}: 기대 ${status}, 실제 ${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

export const CREATED = 201
export const read = <T>(person: Person, path: string, step: string) =>
  person.api.get(path).then(response => ok<T>(response, step))
type Sending = { body: unknown; step: string; status: number }
const send = async <T>(person: Person, path: string, { body, step, status }: Sending) =>
  ok<T>(await person.api.post(path, body), step, status)
// 만드는 쓰기는 201(create), 나머지는 200(write)이다.
export const write = <T>(person: Person, path: string, body: unknown, step: string) =>
  send<T>(person, path, { body, step, status: 200 })
export const create = <T>(person: Person, path: string, body: unknown, step: string) =>
  send<T>(person, path, { body, step, status: CREATED })

// 쓰기 전에 그 인물의 화면이 읽는 GET 응답에 그 동작이 있는지 본다(DEC-38: 화면은 서버가 준 동작만 보고 버튼을 낸다).
export async function sees<T>(
  person: Person,
  path: string,
  actionsOf: (body: T) => readonly string[],
  action: string,
) {
  const body = await read<T>(person, path, '화면 읽기')
  const actions = actionsOf(body)
  if (!actions.includes(action))
    throw new Error(
      `${person.name}의 화면(${path})에 '${action}'이 없다. 있는 동작: ${actions.join(', ') || '없음'}`,
    )
  return body
}

// 학생회 화면의 내 권한 목록에 그 권한이 있는지 본다(동작 이름이 따로 없는 쓰기).
export const seesPermission = (ctx: Ctx, person: Person, permission: string) =>
  sees<{ permissions: string[] }>(person, org(ctx), body => body.permissions, permission)
