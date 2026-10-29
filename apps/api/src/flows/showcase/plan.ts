import type { Moment, ShowcaseContent } from './content/types.js'
import {
  applyStep,
  activateFormStep,
  createFormStep,
  depositsStep,
  feeRosterStep,
} from './form-steps.js'
import type { ShowcaseCtx } from './kit.js'
import {
  accountStep,
  budgetItemStep,
  directExpenseStep,
  evidenceStep,
  incomeStep,
  periodStep,
} from './money-steps.js'
import { decideStep, requestExpenseStep, requestStep, shipmentStep } from './purchase-steps.js'
import { assignStep, createCouncilStep, joinStep } from './setup-steps.js'
import { messageStep } from './talk-steps.js'
import {
  completeEventStep,
  confirmMeetingStep,
  createEventStep,
  createMeetingStep,
  createScheduleStep,
  createTaskStep,
  taskStatusStep,
  writeMinutesStep,
} from './work-steps.js'

// 내용을 때가 붙은 단계 목록으로 펼친다. 실행기(run.ts)가 때 차례로 줄 세워 시계를 옮기며 돈다.
// 같은 때의 단계는 여기 적은 차례를 지킨다(줄 세우기가 안정적이다).
export type Step = { at: Date; label: string; run: () => Promise<void> }

// 운영진이 초대 코드로 들어오는 사이(들어온 차례가 얼굴 색을 정한다)
const JOIN_GAP_MS = 20_000
const MINUTE_MS = 60_000

type Add = (at: Moment | Date, label: string, run: () => Promise<void>) => void

function setupSteps(ctx: ShowcaseCtx, add: Add) {
  const { council } = ctx.content
  add(council.at, '학생회 만들기', () => createCouncilStep(ctx))
  const joinFrom = ctx.cal.dateOf(council.joinFrom).getTime()
  const joining = council.staff.filter(entry => entry.account !== 'president')
  for (const [index, entry] of joining.entries())
    add(new Date(joinFrom + index * JOIN_GAP_MS), `들어오기: ${entry.name}`, () =>
      joinStep(ctx, entry),
    )
  add(council.assignAt, '부서와 직급 나누기', () => assignStep(ctx))
}

function workSteps(ctx: ShowcaseCtx, add: Add) {
  const { events, tasks, meetings, schedule } = ctx.content
  for (const entry of events) {
    add(entry.at, `행사 만들기: ${entry.name}`, () => createEventStep(ctx, entry))
    if (entry.complete)
      add(entry.complete.at, `행사 완료: ${entry.name}`, () => completeEventStep(ctx, entry))
  }
  for (const entry of tasks) {
    add(entry.at, `업무 만들기: ${entry.title}`, () => createTaskStep(ctx, entry))
    if (entry.status)
      add(entry.status.at, `업무 상태: ${entry.title}`, () => taskStatusStep(ctx, entry))
  }
  for (const entry of meetings) {
    add(entry.at, `회의 만들기: ${entry.title}`, () => createMeetingStep(ctx, entry))
    if (entry.minutesAt)
      add(entry.minutesAt, `회의록: ${entry.title}`, () => writeMinutesStep(ctx, entry))
    if (entry.confirmAt)
      add(entry.confirmAt, `회의록 확정: ${entry.title}`, () => confirmMeetingStep(ctx, entry))
  }
  for (const entry of schedule)
    add(entry.at, `일정: ${entry.title}`, () => createScheduleStep(ctx, entry))
}

function moneySteps(ctx: ShowcaseCtx, add: Add) {
  const { finance, expenses } = ctx.content
  add(finance.periodAt, '회계 기간', () => periodStep(ctx, finance))
  add(finance.account.at, `계좌: ${finance.account.name}`, () => accountStep(ctx, finance))
  for (const item of finance.budgetItems)
    add(item.at, `예산 항목: ${item.event ?? ''} ${item.purpose}`, () =>
      budgetItemStep(ctx, finance.by, item),
    )
  for (const income of finance.incomes)
    add(income.at, `수입: ${income.amount}원`, () => incomeStep(ctx, finance.by, income))
  for (const entry of expenses) {
    let expenseId = ''
    add(entry.at, `지출: ${entry.description}`, async () => {
      expenseId = await directExpenseStep(ctx, entry)
    })
    if (entry.evidenceAt)
      add(entry.evidenceAt, `증빙: ${entry.description}`, () =>
        evidenceStep(ctx, entry.by, expenseId),
      )
  }
}

function purchaseSteps(ctx: ShowcaseCtx, add: Add) {
  for (const entry of ctx.content.purchases) {
    const label = (what: string) => `${what}: ${entry.title}`
    add(entry.at, label('구매 요청'), () => requestStep(ctx, entry))
    if (entry.decision) add(entry.decision.at, label('결재'), () => decideStep(ctx, entry))
    if (entry.shipment) add(entry.shipment.at, label('송장'), () => shipmentStep(ctx, entry))
    const { expense } = entry
    if (!expense) continue
    let expenseId = ''
    add(expense.at, label('결제한 지출'), async () => {
      expenseId = await requestExpenseStep(ctx, entry)
    })
    if (expense.evidenceAt)
      add(expense.evidenceAt, label('증빙'), () => evidenceStep(ctx, expense.by, expenseId))
  }
}

function formSteps(ctx: ShowcaseCtx, add: Add) {
  const { forms, feeRoster } = ctx.content
  add(feeRoster.at, '학생회비 납부자 명단', () => feeRosterStep(ctx, feeRoster))
  for (const entry of forms) {
    const label = (what: string) => `${what}: ${entry.event} ${entry.name}`
    add(entry.at, label('신청 양식'), () => createFormStep(ctx, entry))
    if (entry.activateAt)
      add(entry.activateAt, label('링크 열기'), () => activateFormStep(ctx, entry))
    const { applications } = entry
    const from = applications ? ctx.cal.dateOf(applications.from).getTime() : 0
    for (const [index, applicant] of (applications?.list ?? []).entries())
      add(
        new Date(from + index * applications!.everyMinutes * MINUTE_MS),
        label(`신청 ${applicant.name}`),
        () => applyStep(ctx, entry, { applicant, index }),
      )
    if (entry.deposits) add(entry.deposits.at, label('입금 확인'), () => depositsStep(ctx, entry))
  }
}

export function planOf(ctx: ShowcaseCtx): Step[] {
  const steps: Step[] = []
  const add: Add = (at, label, run) =>
    steps.push({ at: at instanceof Date ? at : ctx.cal.dateOf(at), label, run })
  setupSteps(ctx, add)
  workSteps(ctx, add)
  moneySteps(ctx, add)
  purchaseSteps(ctx, add)
  for (const entry of ctx.content.messages)
    add(entry.at, `메시지: ${entry.by}`, () => messageStep(ctx, entry))
  formSteps(ctx, add)
  return steps
}

// 시계는 앞으로만 가고 돌리는 때를 넘지 못한다(거래 범위 시계). 단계를 때 차례로 줄 세우고,
// 오늘 아직 오지 않은 때(예: 아침에 돌렸는데 내용은 오늘 낮)는 돌리는 때 바로 앞으로 당긴다. 당겨도 차례는 그대로다.
// 당긴 단계 사이의 간격. 쓰기 한도(한 사람 10초에 20번)에 걸리지 않게 단계마다 이만큼 띄운다.
const STEP_GAP_MS = 10_000
export function timeline(steps: Step[], finalAt: Date, content: ShowcaseContent, start: Date) {
  const sorted = [...steps].sort((a, b) => a.at.getTime() - b.at.getTime())
  const early = sorted.find(step => step.at.getTime() < start.getTime())
  if (early)
    throw new Error(`'${early.label}'이(가) 학생회 만들기(${content.council.at})보다 앞이다`)
  const last = sorted.length - 1
  return sorted.map((step, index) => ({
    ...step,
    at: new Date(Math.min(step.at.getTime(), finalAt.getTime() - (last - index) * STEP_GAP_MS)),
  }))
}
