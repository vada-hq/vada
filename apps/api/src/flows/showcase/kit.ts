import type { Person } from '../people.js'
import { read, sees, type EvidenceUploader } from '../rehearsal-kit.js'
import type { Flow } from '../server.js'
import type { BudgetRef, ShowcaseContent } from './content/types.js'
import type { Calendar } from './moment.js'

// 시연 학생회 실행기의 맥락. 단계 파일들이 같이 쓴다. 번호는 앞 단계가 응답에서 읽어 채우고 뒤 단계가 이름으로 찾는다.
export type Member = Person & { memberId: string; virtual: boolean }

export type World = {
  councilId: string
  inviteCode: string
  accountId: string
  departments: Map<string, string>
  events: Map<string, string>
  tasks: Map<string, string>
  budget: Map<string, string>
  messages: Map<string, string>
  meetings: Map<string, string>
  requests: Map<string, { id: string; items: Map<string, string> }>
  forms: Map<string, { id: string; publicCode: string }>
}

export type ShowcaseCtx = {
  flow: Flow
  cal: Calendar
  content: ShowcaseContent
  council: { name: string; schoolName: string }
  // 내용의 이름 → 인물. 실제 계정이면 그 계정, 아니면 가상 인물이다. memberId는 학생회에 들어온 뒤 채운다.
  people: Map<string, Member>
  w: World
  uploadEvidence: EvidenceUploader
}

export const emptyWorld = (): World => ({
  councilId: '',
  inviteCode: '',
  accountId: '',
  departments: new Map(),
  events: new Map(),
  tasks: new Map(),
  budget: new Map(),
  messages: new Map(),
  meetings: new Map(),
  requests: new Map(),
  forms: new Map(),
})

export const org = (ctx: ShowcaseCtx) => `/api/organizations/${ctx.w.councilId}`

// 이름으로 찾는다. 없으면 내용 파일의 어디가 틀렸는지 알리며 던진다.
export function found<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key)
  if (value === undefined)
    throw new Error(`${what} '${key}'이(가) 없다(내용 파일이나 단계 차례를 본다)`)
  return value
}

export const who = (ctx: ShowcaseCtx, name: string) => found(ctx.people, name, '운영진')
export const budgetKey = ({ event, purpose }: BudgetRef) => `${event ?? ''}\u0000${purpose}`
export const budgetId = (ctx: ShowcaseCtx, ref: BudgetRef) =>
  found(ctx.w.budget, budgetKey(ref), `예산 항목(${ref.event ?? '행사 없음'})`)
export const eventId = (ctx: ShowcaseCtx, name: string) => found(ctx.w.events, name, '행사')
export const departmentId = (ctx: ShowcaseCtx, name: string) =>
  found(ctx.w.departments, name, '부서')
export const memberIdOf = (ctx: ShowcaseCtx, name: string) => who(ctx, name).memberId

// 학생회 화면의 내 권한 목록에 그 권한이 있는지 본다(동작 이름이 따로 없는 쓰기, DEC-38).
export const seesPermission = (ctx: ShowcaseCtx, person: Person, permission: string) =>
  sees<{ permissions: string[] }>(person, org(ctx), body => body.permissions, permission)

// 내 운영진 번호(학생회 화면의 me)
export const myMemberId = async (ctx: ShowcaseCtx, person: Person) =>
  (await read<{ me: { memberId: string } }>(person, org(ctx), '학생회 읽기')).me.memberId
