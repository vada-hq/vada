import { randomUUID } from 'node:crypto'
import type {
  ApplicantsResponse,
  ApplyResponse,
  BudgetResponse,
  EventResponse,
  RegistrationFormResponse,
  RegistrationFormsResponse,
  StaffDepositResponse,
  TaskResponse,
} from '@vada/contracts'
import { DAY_MS } from '@vada/contracts'
import type { FlowCaller } from './driver.js'
import {
  type Applicant,
  CREATED,
  create,
  koreanTime,
  org,
  read,
  sees,
  seesPermission,
  write,
  type Ctx,
} from './rehearsal-kit.js'

const EVENT_LENGTH_MS = 10_800_000
const UPCOMING_DAYS = 7
const EVENT_BUDGET = 100_000
const FORM_CAPACITY = 30
export const FEE = 10_000
const APPLICANT_NAMES = ['신청자 가', '신청자 나', '신청자 다'] as const

// 행사 날짜. 끝난 행사는 마지막 단계 하루 전에 끝나고, 앞으로 열릴 행사는 이레 뒤에 열리며, 날짜 없는 행사는 비운다.
function schedule(ctx: Ctx) {
  if (ctx.plan.schedule === 'tbd') return { startsAt: null, endsAt: null }
  const endAt =
    ctx.plan.schedule === 'ended'
      ? ctx.finalAt.getTime() - DAY_MS
      : ctx.finalAt.getTime() + UPCOMING_DAYS * DAY_MS + EVENT_LENGTH_MS
  return {
    startsAt: koreanTime(new Date(endAt - EVENT_LENGTH_MS)),
    endsAt: koreanTime(new Date(endAt)),
  }
}

// 1 행사 만들기: 부회장이 책임자를 기획부장으로 두고 만들고, 회장이 장소를 고친다(DEC-79). 재정부장이 행사용 예산 항목을 더한다.
// 행사 만들기는 회장단만 한다(event.create). 그래서 명세의 '기획부장이 만든다'를 '기획부장을 책임자로 두고 부회장이 만든다'로 한다.
export async function createEventStep(ctx: Ctx) {
  const { vice, chief, financeHead } = ctx.cast
  const { w, plan } = ctx
  await seesPermission(ctx, vice, 'event.create')
  const dates = schedule(ctx)
  const created = await create<EventResponse>(
    vice,
    `${org(ctx)}/events`,
    { name: plan.name, ...dates, place: '학생회관', ownerId: w.memberIds.planHead },
    '행사 만들기',
  )
  w.eventId = created.event.id
  const path = `${org(ctx)}/events/${w.eventId}`
  await sees<EventResponse>(chief, path, body => body.event.actions, 'event.update')
  await write<EventResponse>(
    chief,
    path,
    { name: plan.name, ...dates, place: '대강당' },
    '행사 장소 고치기',
  )
  await seesPermission(ctx, financeHead, 'finance.manage')
  const budget = await create<BudgetResponse>(
    financeHead,
    `${org(ctx)}/budget-items`,
    { purpose: `${plan.name} 물품비`, amount: EVENT_BUDGET, type: 'expense', eventId: w.eventId },
    '행사 예산 항목',
  )
  w.budgetItemIds.event = budget.items.find(item => item.event?.id === w.eventId)!.id
}

// 2 신청 양식: 기획부장(책임자)이 참가비·정원·참가비 계좌로 양식을 연다. 마감은 행사 시작이다.
export async function openFormStep(ctx: Ctx) {
  const { planHead } = ctx.cast
  const { w } = ctx
  await sees<RegistrationFormsResponse>(
    planHead,
    `${org(ctx)}/events/${w.eventId}/registration-forms`,
    body => body.actions,
    'form.create',
  )
  const { startsAt } = schedule(ctx)
  const created = await create<RegistrationFormResponse>(
    planHead,
    `${org(ctx)}/events/${w.eventId}/registration-forms`,
    {
      name: `${ctx.plan.name} 참가 신청`,
      closesAt: startsAt,
      capacity: FORM_CAPACITY,
      payerFee: FEE,
      nonPayerFee: FEE,
      feeAccountId: w.accountIds.fee,
    },
    '신청 양식 만들기',
  )
  w.formId = created.form.id
  w.publicCode = created.form.publicCode
}

// 3 공개 신청: 신청자 셋이 공개 경로로 신청한다. 첫째는 같은 명령을 한 번 더 보내 새 신청이 생기지 않고 새 링크를 받는다.
export async function applyStep(ctx: Ctx) {
  const visitor = ctx.flow.driver.as('visitor')
  const base = `/api/public/registration-forms/${ctx.w.publicCode}`
  const form = (await (await visitor.get(base)).json()) as { status: string }
  if (form.status !== 'open') throw new Error(`공개 신청: 양식이 받는 중이 아니다(${form.status})`)
  for (const [index, name] of APPLICANT_NAMES.entries()) {
    const applicant: Applicant = {
      name,
      studentId: `20260000${index + 1}`,
      commandId: randomUUID(),
      token: '',
      staleToken: null,
      id: '',
    }
    const body = { commandId: applicant.commandId, name, studentId: applicant.studentId }
    const first = await apply(visitor, base, body)
    applicant.token = first.token
    if (index === 0) {
      applicant.staleToken = first.token
      applicant.token = (await apply(visitor, base, body)).token
    }
    ctx.w.applicants.push(applicant)
  }
}

async function apply(visitor: FlowCaller, base: string, body: unknown) {
  const response = await visitor.post(`${base}/apply`, body)
  if (response.status !== CREATED)
    throw new Error(`공개 신청: ${response.status} ${await response.text()}`)
  return (await response.json()) as ApplyResponse
}

// 4 입금 확인: 기획부장(책임자)이 둘의 입금을 확인하고, 한 명은 입금 뒤 신청을 취소해 환불함으로 둔다.
// 입금 확인은 책임자·담당 부서·회장단의 권한이라 재정부원이 아니라 기획부장이 한다(환불함은 재정부원, refund 단계).
export async function confirmDepositStep(ctx: Ctx) {
  const { planHead } = ctx.cast
  const path = `${org(ctx)}/registration-forms/${ctx.w.formId}/applicants`
  const listed = await read<ApplicantsResponse>(planHead, path, '신청자 읽기')
  for (const applicant of ctx.w.applicants) {
    const found = listed.applicants.find(item => item.name === applicant.name)
    if (!found) throw new Error(`신청자 목록에 ${applicant.name}이 없다`)
    applicant.id = found.id
  }
  const [first, second] = ctx.w.applicants
  for (const applicant of [first!, second!]) {
    const row = (await read<ApplicantsResponse>(planHead, path, '신청자 읽기')).applicants.find(
      item => item.id === applicant.id,
    )!
    if (!row.actions.includes('deposit.confirm'))
      throw new Error(`입금 확인: ${applicant.name}의 줄에 deposit.confirm이 없다`)
    await create<StaffDepositResponse>(
      planHead,
      `${org(ctx)}/registrations/${applicant.id}/deposit`,
      { amount: null },
      '입금 확인',
    )
  }
  const row = (await read<ApplicantsResponse>(planHead, path, '신청자 읽기')).applicants.find(
    item => item.id === second!.id,
  )!
  if (!row.actions.includes('registration.cancel'))
    throw new Error('신청 취소: 입금 확인한 줄에 registration.cancel이 없다')
  await write(planHead, `${org(ctx)}/registrations/${second!.id}/cancel`, {}, '신청 취소')
}

// 5 업무: 기획부장이 행사 업무를 만들어 기획부원에게 맡긴다. 끝내기는 구매 요청과 결제가 자동으로 옮긴다(015).
export async function assignTaskStep(ctx: Ctx) {
  const { planHead, planner } = ctx.cast
  const { w } = ctx
  const created = await create<TaskResponse>(
    planHead,
    `${org(ctx)}/tasks`,
    { title: '물품 준비', departmentId: w.departmentIds.planning, eventId: w.eventId },
    '업무 만들기',
  )
  w.taskId = created.task.id
  const path = `${org(ctx)}/tasks/${w.taskId}`
  await sees<TaskResponse>(planHead, path, body => body.task.actions, 'task.change_assignee')
  await write<TaskResponse>(
    planHead,
    `${path}/assignee`,
    { assigneeId: w.memberIds.planner },
    '업무 맡기기',
  )
  await sees<TaskResponse>(planner, path, body => body.task.actions, 'task.change_status')
}
