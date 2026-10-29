import { randomUUID } from 'node:crypto'
import type {
  AnswerInput,
  ApplicantsResponse,
  PublicRegistrationForm,
  RegistrationFormResponse,
  RegistrationFormsResponse,
  StaffDepositResponse,
} from '@vada/contracts'
import { CREATED, create, read, sees, write } from '../rehearsal-kit.js'
import type { ApplicantEntry, FeeRosterEntry, FormEntry } from './content/types.js'
import { eventId, found, org, seesPermission, who, type ShowcaseCtx } from './kit.js'

// 신청 양식, 학생회비 납부자 명단, 공개 신청, 입금 확인.

const formOf = (ctx: ShowcaseCtx, entry: FormEntry) => found(ctx.w.forms, entry.event, '신청 양식')
const FAKE_PHONE_PREFIX = '0100000'
const PHONE_SERIAL_DIGITS = 4
// 가짜 휴대폰 번호: 010-0000-0001부터 신청 차례대로
const fakePhone = (index: number) =>
  `${FAKE_PHONE_PREFIX}${String(index + 1).padStart(PHONE_SERIAL_DIGITS, '0')}`

export async function createFormStep(ctx: ShowcaseCtx, entry: FormEntry) {
  const person = who(ctx, entry.by)
  const path = `${org(ctx)}/events/${eventId(ctx, entry.event)}/registration-forms`
  await sees<RegistrationFormsResponse>(person, path, body => body.actions, 'form.create')
  const created = await create<RegistrationFormResponse>(
    person,
    path,
    {
      name: entry.name,
      opensAt: entry.opensAt ? ctx.cal.koreanOf(entry.opensAt) : null,
      closesAt: ctx.cal.koreanOf(entry.closesAt),
      capacity: entry.capacity,
      notice: entry.notice ? ctx.cal.text(entry.notice) : null,
      collectsPhone: entry.collectsPhone,
      collectsStudentId: true,
      payerFee: entry.fees?.payer ?? null,
      nonPayerFee: entry.fees?.nonPayer ?? null,
      feeAccountId: entry.fees ? ctx.w.accountId : null,
      questions: entry.questions.map(question => ({
        kind: question.kind,
        title: question.title,
        required: question.required,
        choices: (question.choices ?? []).map(label => ({ label })),
      })),
    },
    '신청 양식 만들기',
  )
  ctx.w.forms.set(entry.event, { id: created.form.id, publicCode: created.form.publicCode })
}

// 양식 만들기와 공개 신청 사이에 조건을 확인하고 링크를 연다(DEC-93).
export async function activateFormStep(ctx: ShowcaseCtx, entry: FormEntry) {
  const person = who(ctx, entry.by)
  const path = `${org(ctx)}/registration-forms/${formOf(ctx, entry).id}`
  await sees<RegistrationFormResponse>(person, path, body => body.form.actions, 'form.activate')
  await write<RegistrationFormResponse>(person, `${path}/activate`, {}, '링크 활성화')
}

export async function feeRosterStep(ctx: ShowcaseCtx, roster: FeeRosterEntry) {
  const person = who(ctx, roster.by)
  await seesPermission(ctx, person, 'fee_payment.manage')
  await write(
    person,
    `${org(ctx)}/fee-payments`,
    {
      paidFrom: ctx.cal.dayOf(roster.paidFrom),
      paidUntil: ctx.cal.dayOf(roster.paidUntil),
      students: roster.studentIds.join('\n'),
    },
    '학생회비 명단 올리기',
  )
}

// 질문 차례대로 답을 만든다. 고르기는 선택지 이름으로 번호를 찾는다.
function answersOf(form: PublicRegistrationForm, applicant: ApplicantEntry): AnswerInput[] {
  return form.questions.map((question, index) => {
    const value = applicant.answers[index] ?? null
    if (question.kind === 'short_text') return { questionId: question.id, text: value }
    const choice = value === null ? null : question.choices.find(item => item.label === value)
    if (value !== null && !choice)
      throw new Error(`'${question.title}'에 선택지 '${value}'가 없다(${applicant.name})`)
    if (question.kind === 'multiple_choice')
      return { questionId: question.id, choiceIds: choice ? [choice.id] : [] }
    return { questionId: question.id, choiceId: choice?.id ?? null }
  })
}

// 공개 신청: 로그인 없는 방문자가 공개 경로로 한다(화면의 신청 페이지와 같은 길).
export async function applyStep(
  ctx: ShowcaseCtx,
  entry: FormEntry,
  { applicant, index }: { applicant: ApplicantEntry; index: number },
) {
  const visitor = ctx.flow.driver.as('visitor')
  const base = `/api/public/registration-forms/${formOf(ctx, entry).publicCode}`
  const form = (await (await visitor.get(base)).json()) as PublicRegistrationForm
  if (form.status !== 'open') throw new Error(`공개 신청: 양식이 받는 중이 아니다(${form.status})`)
  const response = await visitor.post(`${base}/apply`, {
    commandId: randomUUID(),
    name: applicant.name,
    studentId: applicant.studentId,
    phone: entry.collectsPhone ? fakePhone(index) : null,
    answers: answersOf(form, applicant),
  })
  if (response.status !== CREATED)
    throw new Error(`공개 신청(${applicant.name}): ${response.status} ${await response.text()}`)
}

// 입금 확인: 입금했다고 적은 신청자마다 적용 참가비 그대로 확인한다.
export async function depositsStep(ctx: ShowcaseCtx, entry: FormEntry) {
  const person = who(ctx, entry.deposits!.by)
  const path = `${org(ctx)}/registration-forms/${formOf(ctx, entry).id}/applicants`
  const listed = await read<ApplicantsResponse>(person, path, '신청자 읽기')
  for (const applicant of entry.applications?.list ?? []) {
    if (!applicant.deposit) continue
    const row = listed.applicants.find(item => item.studentId === applicant.studentId)
    if (!row) throw new Error(`신청자 목록에 ${applicant.name}이 없다`)
    if (!row.actions.includes('deposit.confirm'))
      throw new Error(`입금 확인: ${applicant.name}의 줄에 deposit.confirm이 없다`)
    await create<StaffDepositResponse>(
      person,
      `${org(ctx)}/registrations/${row.id}/deposit`,
      { amount: null },
      '입금 확인',
    )
  }
}
