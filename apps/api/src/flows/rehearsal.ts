import { DAY_MS } from '@vada/contracts'
import { createPerson, type Person } from './people.js'
import {
  applyStep,
  assignTaskStep,
  confirmDepositStep,
  createEventStep,
  openFormStep,
} from './rehearsal-event.js'
import {
  emptyWorld,
  ROLES,
  type Cast,
  type CouncilNames,
  type Ctx,
  type EventPlan,
  type EvidenceUploader,
  type Role,
  type World,
} from './rehearsal-kit.js'
import {
  completeStep,
  decideStep,
  refundStep,
  reimburseStep,
  requestStep,
  spendStep,
} from './rehearsal-money.js'
import { createCouncilStep, financeBaseStep, joinPeopleStep } from './rehearsal-setup.js'
import type { Flow } from './server.js'

// 리허설 시나리오(기능 017): 행사 만들기부터 완료까지를 한 곳에 한 번만 적는다. 흐름 시험과 시연 데이터가 같은 단계를 돈다.
// 단계마다 누가(who), 언제(마지막 단계에서 거슬러 센 시각), 무엇을(run: 화면이 부르는 HTTP 경로와 본문)이다.
// 단계는 쓰기 전에 그 인물의 화면 응답(GET)에 동작이 있는지 먼저 보고, 없으면 어느 단계에서 끊겼는지 알리며 던진다.
// 명세의 단계 0~10과의 대응: council·people·finance가 0, event 1, form 2, apply 3, deposit 4, task 5, request 6, decide 7,
// spend 8, reimburse·refund 9, complete 10. 단계 하나를 omit으로 빼면 뒤 단계가 어디서 끊기는지 볼 수 있다.
const HOUR_MS = 3_600_000
// ago는 마지막 단계에서 거슬러 센 시간이다(days일 hours시간 전). 앞 단계일수록 크다.
type Step = {
  name: string
  who: string
  ago: { days: number; hours: number }
  run: (ctx: Ctx) => Promise<void>
}

const STEPS = [
  { name: 'council', who: '회장', ago: { days: 14, hours: 0 }, run: createCouncilStep },
  { name: 'people', who: '회장과 인물 전원', ago: { days: 13, hours: 23 }, run: joinPeopleStep },
  { name: 'finance', who: '재정부장', ago: { days: 13, hours: 22 }, run: financeBaseStep },
  {
    name: 'event',
    who: '부회장, 회장, 재정부장',
    ago: { days: 13, hours: 0 },
    run: createEventStep,
  },
  { name: 'form', who: '기획부장', ago: { days: 12, hours: 0 }, run: openFormStep },
  { name: 'apply', who: '신청자 셋', ago: { days: 11, hours: 0 }, run: applyStep },
  { name: 'deposit', who: '기획부장', ago: { days: 10, hours: 0 }, run: confirmDepositStep },
  { name: 'task', who: '기획부장, 기획부원', ago: { days: 9, hours: 0 }, run: assignTaskStep },
  { name: 'request', who: '기획부원', ago: { days: 8, hours: 0 }, run: requestStep },
  { name: 'decide', who: '재정부장', ago: { days: 7, hours: 0 }, run: decideStep },
  { name: 'spend', who: '재정부원', ago: { days: 6, hours: 0 }, run: spendStep },
  { name: 'reimburse', who: '재정부원', ago: { days: 0, hours: 12 }, run: reimburseStep },
  { name: 'refund', who: '재정부원', ago: { days: 0, hours: 11 }, run: refundStep },
  { name: 'complete', who: '회장', ago: { days: 0, hours: 0 }, run: completeStep },
] as const satisfies readonly Step[]
export type StepName = (typeof STEPS)[number]['name']

const agoMs = ({ days, hours }: Step['ago']) => days * DAY_MS + hours * HOUR_MS
export const REHEARSAL_SPAN_MS = agoMs(STEPS[0].ago)
// 시나리오를 시작할 시각. 흐름 서버(startFlow)의 start로 준다. 마지막 단계가 finalAt이다.
export const rehearsalStart = (finalAt: Date) => new Date(finalAt.getTime() - REHEARSAL_SPAN_MS)

// 행사 A는 끝까지, B는 '구매 요청'까지, C는 만들기만 한다.
export const EVENT_A: EventPlan = { name: '신입생 환영회', schedule: 'ended' }
export const EVENT_B: EventPlan = { name: '체육대회', schedule: 'upcoming' }
export const EVENT_C: EventPlan = { name: '졸업 준비 모임', schedule: 'tbd' }

const PEOPLE: Record<Exclude<Role, 'chief'>, string> = {
  vice: '부회장',
  planHead: '기획부장',
  planner: '기획부원',
  financeHead: '재정부장',
  financeStaff: '재정부원',
  prHead: '홍보부장',
}

export type RehearsalState = { cast: Cast; w: World }
export type RehearsalOptions = {
  // 회장. 흐름 시험은 시험 계정을, 시연은 실제 사용자를 흐름 세션에 들여 준다.
  chief: Person
  // 마지막 단계의 시각. 시연은 돌리는 때(실제 시각을 넘으면 거래 범위 시계가 던진다), 흐름 시험은 고정값이다.
  finalAt: Date
  // 이 단계까지 하고 멈춘다(포함). 없으면 끝까지.
  stopAfter?: StepName
  // 건너뛸 단계. 뒤 단계가 막히는지 보려는 것이다.
  omit?: readonly StepName[]
  // 있으면 증빙을 올린 것으로 만든다(흐름 시험의 가짜 저장소). 없으면 증빙 줄을 건너뛴다.
  uploadEvidence?: EvidenceUploader
  // 만들 학생회의 이름(시연이 학교 이름을 정한다). 이어 돌 때는 쓰지 않는다.
  council?: CouncilNames
  // 행사. 기본은 A다.
  event?: EventPlan
  // 앞서 돈 학생회에서 이어 새 행사를 만든다(B와 C). 행사 단계부터 지금 시각에서 돌고 시계를 옮기지 않는다.
  resume?: RehearsalState
}

async function castOf(flow: Flow, chief: Person): Promise<Cast> {
  const cast = { chief } as Cast
  for (const role of ROLES) {
    if (role === 'chief') continue
    cast[role] = await createPerson(flow, role, PEOPLE[role])
  }
  return cast
}

// 학생회에서 이어 새 행사를 만들 때 행사에 딸린 번호만 비운다.
function worldForNewEvent(w: World): World {
  return {
    ...emptyWorld(),
    councilId: w.councilId,
    inviteCode: w.inviteCode,
    memberIds: w.memberIds,
    departmentIds: w.departmentIds,
    accountIds: w.accountIds,
    periodId: w.periodId,
    budgetItemIds: { event: '', standing: w.budgetItemIds.standing },
  }
}

function stepsOf({ stopAfter, omit = [], resume }: RehearsalOptions) {
  const from = resume ? STEPS.findIndex(step => step.name === 'event') : 0
  const to = stopAfter ? STEPS.findIndex(step => step.name === stopAfter) + 1 : STEPS.length
  return STEPS.slice(from, to).filter(step => !omit.some(name => name === step.name))
}

export async function runRehearsal(flow: Flow, options: RehearsalOptions) {
  const { resume } = options
  const ctx: Ctx = {
    flow,
    cast: resume?.cast ?? (await castOf(flow, options.chief)),
    w: resume ? worldForNewEvent(resume.w) : emptyWorld(),
    plan: options.event ?? EVENT_A,
    finalAt: options.finalAt,
    uploadEvidence: options.uploadEvidence,
    council: options.council,
  }
  const ran: StepName[] = []
  for (const step of stepsOf(options)) {
    try {
      if (!resume) await flow.driver.travelTo(new Date(options.finalAt.getTime() - agoMs(step.ago)))
      await step.run(ctx)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`리허설 단계 '${step.name}'(${step.who}): ${reason}`, { cause: error })
    }
    ran.push(step.name)
  }
  return { state: { cast: ctx.cast, w: ctx.w } satisfies RehearsalState, ran }
}
