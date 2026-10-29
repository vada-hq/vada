// ─────────────────────────────────────────────────────────────────────────────
// 공용 파일: 만드는 쪽(v1~v3)은 읽기만 한다. 고치려면 진행 에이전트에게 말한다.
// ─────────────────────────────────────────────────────────────────────────────
// 신청자 화면(신청 양식 영역 첫 화면) 시안의 공용 견본. 판 문서: notes/integration/events/form-apply-board.md
// 내용: notes/integration/events/form-apply-content.md(목적, 구역 ①~⑤, 화면 차례).
// 견본 하나 = 서버가 주는 모양(form, mine: v0가 지금 부품에 그대로 넣는다) + 화면 글(text: 이미 만든 글) + 서버에 아직 없는 칸.
// 화면 글은 지금 구현의 도우미(feeText, whenLabel, 고지 조립)로 만들어 v0와 글이 같다. 법정 고지 문구는 바꾸지 않는다.
import type { MyRegistration, PublicRegistrationForm } from '@vada/contracts'
import { momentLabel, whenLabel } from '@/events/event-view'
import type { FieldErrors } from '@/lib/use-form-check'
import {
  closedLine,
  collectedItems,
  dateText,
  feeText,
  inquiryText,
  noticePurpose,
  STATUS_LABEL,
  won,
} from '../registration-text'
import { applyErrors, EMPTY_VALUES, type ApplyValues } from '../useApply'
import { id, LONG_QUESTIONS, MAIN_QUESTIONS } from './form-questions'

// apply·done 화면의 견본
export const FORM_DATA_NAMES = ['main', 'free', 'long', 'dayof'] as const
export type FormDataName = (typeof FORM_DATA_NAMES)[number]
// closed 화면의 견본(받지 않는 까닭)
export const CLOSED_DATA_NAMES = [
  'full',
  'before',
  'paused',
  'ended',
  'cancelled',
  'moved',
] as const
export type ClosedDataName = (typeof CLOSED_DATA_NAMES)[number]
export type FormSampleName = FormDataName | ClosedDataName

// 화면에 쓰는 글. 지금 구현과 같은 꼴이다. 자르지 않는다.
export type FormText = {
  // 학생회 이름 '컴퓨터공학과'
  council: string
  // 행사 이름(30자까지)
  event: string
  // '11월 3일 (화) 18:00까지'. 받는 중일 때만 있다(closed 견본은 null).
  deadline: string | null
  // '2월 23일 (화) 10:00 ~ 2월 25일 (목) 12:00'
  when: string
  // '가평 베이직하우스', 없으면 null
  place: string | null
  // 신청 전 참가비: '학생회비 납부자 5,000원 · 미납자 10,000원' / '무료'
  fee: string
  // [신청하기] 아래 법정 고지 전문(지금 구현 문구 그대로, 바꾸지 않는다)
  notice: string
  // 신청 뒤 내 참가비(적용 참가비): '10,000원' / '무료'
  appliedFee: string
  // 신청 뒤 입금 계좌 '카카오뱅크 3333-01-2345678'. 참가비가 0이면 null
  account: string | null
  // 예금주 '컴퓨터공학과 학생회'. 참가비가 0이면 null
  holder: string | null
  // 맨 아래 지우는 날 글 '신청 정보는 2028년 2월 25일에 지워져요.'
  purge: string
}

// 받지 않는 까닭(⑤ 카드). 문구는 지금 구현 것이고, 취소된 행사·새 설문으로 이동은 지금 구현에 없어 새로 적었다.
export type FormClosed = {
  kind: ClosedDataName
  // 카드 제목 '정원 마감' / '시작 전' / '잠시 멈춤' / '마감' / '취소된 행사' / '새 설문으로 이동'
  title: string
  // 설명 한 줄
  line: string
  // 카드 버튼. moved만 새 설문 주소가 있다.
  action: { label: '돌아가기'; href: null } | { label: '새 설문으로 이동'; href: string }
}

// 입금 상태(서버 MyRegistration.depositConfirmed에서 나온 글). 참가비가 0이면 null
export type FormDeposit = '입금 전' | '입금 확인됨' | null

export type FormSample = {
  name: FormSampleName
  // 오늘(한국 날짜)
  today: string
  // 오늘이 행사 기간 안(입장 QR이 맨 위로 오는 때, 내용 ④)
  eventDay: boolean
  // 공개 양식(서버 모양 그대로). closed 견본은 status가 받지 않는 상태다.
  form: PublicRegistrationForm
  // 신청 뒤 내 신청(서버 모양 그대로). depositConfirmed가 입금 상태다.
  mine: MyRegistration
  text: FormText
  // 운영진이 쓰는 완료 안내(DEC-93, 서버에 아직 없음). 없으면 null
  doneNotice: string | null
  deposit: FormDeposit
  // apply 화면의 처음 입력 상태. 칸 이름: name, studentId, phone, answers(질문 id → 글 또는 선택지 id들)
  input: ApplyValues
  // 처음부터 보일 칸 문제(누른 뒤 모습). 칸 이름 → 글: name, studentId, phone, answers.<질문 차례>. 없으면 {}
  errors: FieldErrors
  // closed 화면의 카드. apply·done 견본은 null
  closed: FormClosed | null
}

// 참가비(학생회비 납부자·미납자)와 남은 자리
const PAYER_FEE = 5000
const NON_PAYER_FEE = 10000
const REMAINING = 37

const MAIN_FORM: PublicRegistrationForm = {
  councilName: '컴퓨터공학과',
  event: {
    name: '2026 새내기 배움터',
    startsAt: '2027-02-23T10:00',
    endsAt: '2027-02-25T12:00',
    place: '가평 베이직하우스',
  },
  form: { name: '참가 신청', opensAt: null, closesAt: '2026-11-03T18:00', notice: null },
  status: 'open',
  remaining: REMAINING,
  payerFee: PAYER_FEE,
  nonPayerFee: NON_PAYER_FEE,
  collectsStudentId: true,
  collectsPhone: true,
  questions: MAIN_QUESTIONS,
  // 행사 끝(2027-02-25)의 한국 날짜 + 1년(DEC-55)
  purgeOn: '2028-02-25',
}

const ACCOUNT = {
  bank: '카카오뱅크',
  accountNumber: '3333-01-2345678',
  holder: '컴퓨터공학과 학생회',
}
// 출석 QR 글자 꼴(VADA: + 64자). 값은 아무것이나 된다.
const QR_TEXT = 'VADA:3F9A2C7E1B5D4A603F9A2C7E1B5D4A603F9A2C7E1B5D4A603F9A2C7E1B5D4A60'

const MAIN_MINE: MyRegistration = {
  event: { name: MAIN_FORM.event.name },
  form: { notice: MAIN_FORM.form.notice },
  mine: { name: '김바다', studentId: '20261234', phone: '01012345678' },
  answers: [
    { questionId: id('101'), title: '티셔츠 사이즈', values: ['L'] },
    { questionId: id('102'), title: '버스 탑승', values: ['학교에서 함께 출발'] },
    { questionId: id('103'), title: '못 먹는 음식', values: [] },
  ],
  appliedFee: NON_PAYER_FEE,
  depositConfirmed: false,
  account: ACCOUNT,
  qrText: QR_TEXT,
  attended: false,
  cancellable: true,
}

const DONE_NOTICE = '입금은 11월 5일까지 해 주세요. 단톡방은 신청 마감 뒤 초대해요.'

// 버튼 아래 고지. ApplyFields.tsx의 Notice와 같은 조립이다(문구를 바꾸지 않는다).
function noticeText(form: PublicRegistrationForm) {
  return (
    `받는 곳: ${form.councilName} · 받는 항목: ${collectedItems(form).join(', ')} · 목적: ` +
    `${noticePurpose(form)} · 지우는 날: ${dateText(form.purgeOn)}. ${inquiryText(form.form.notice)}`
  )
}

function textOf(form: PublicRegistrationForm, mine: MyRegistration): FormText {
  return {
    council: form.councilName,
    event: form.event.name,
    deadline: form.status === 'open' ? `${momentLabel(form.form.closesAt)}까지` : null,
    when: whenLabel(form.event),
    place: form.event.place,
    fee: feeText(form),
    notice: noticeText(form),
    appliedFee: won(mine.appliedFee),
    account: mine.account ? `${mine.account.bank} ${mine.account.accountNumber}` : null,
    holder: mine.account?.holder ?? null,
    purge: `신청 정보는 ${dateText(form.purgeOn)}에 지워져요.`,
  }
}

const depositOf = (mine: MyRegistration): FormDeposit =>
  mine.appliedFee === 0 ? null : mine.depositConfirmed ? '입금 확인됨' : '입금 전'

type Parts = Pick<FormSample, 'name' | 'form' | 'mine'> & Partial<FormSample>

function sample({ name, form, mine, ...rest }: Parts): FormSample {
  return {
    name,
    today: '2026-10-29',
    eventDay: false,
    form,
    mine,
    text: textOf(form, mine),
    doneNotice: DONE_NOTICE,
    deposit: depositOf(mine),
    input: EMPTY_VALUES,
    errors: {},
    closed: null,
    ...rest,
  }
}

const main = sample({ name: 'main', form: MAIN_FORM, mine: MAIN_MINE })

const freeForm: PublicRegistrationForm = {
  ...MAIN_FORM,
  remaining: null,
  payerFee: null,
  nonPayerFee: null,
  collectsPhone: false,
  questions: [],
}
const free = sample({
  name: 'free',
  form: freeForm,
  mine: {
    ...MAIN_MINE,
    mine: { name: '김바다', studentId: '20261234', phone: null },
    answers: [],
    appliedFee: 0,
    account: null,
  },
  doneNotice: null,
})

const longForm: PublicRegistrationForm = {
  ...MAIN_FORM,
  event: { ...MAIN_FORM.event, name: '2026 컴퓨터공학과 새내기 배움터와 신입생 환영 캠프' },
  questions: LONG_QUESTIONS,
}
// 학번 비었음, 휴대폰 형식 틀림. 필수 질문은 답해 두어 두 칸만 틀린다.
const longInput: ApplyValues = {
  name: '김바다',
  studentId: '',
  phone: '010-12',
  answers: { [id('201')]: id('215'), [id('202')]: id('223'), [id('203')]: id('231') },
}
const long = sample({
  name: 'long',
  form: longForm,
  mine: {
    ...MAIN_MINE,
    event: { name: longForm.event.name },
    answers: [
      { questionId: id('201'), title: LONG_QUESTIONS[0]!.title, values: ['방 탈출 게임'] },
      { questionId: id('202'), title: LONG_QUESTIONS[1]!.title, values: ['L'] },
      { questionId: id('203'), title: LONG_QUESTIONS[2]!.title, values: ['학교에서 함께 출발'] },
      {
        questionId: id('204'),
        title: LONG_QUESTIONS[3]!.title,
        values: ['레크리에이션', '선배와의 대화'],
      },
      {
        questionId: id('205'),
        title: LONG_QUESTIONS[4]!.title,
        values: ['갑각류 알레르기가 있어요'],
      },
      { questionId: id('206'), title: LONG_QUESTIONS[5]!.title, values: [] },
    ],
  },
  input: longInput,
  errors: applyErrors(longForm, longInput),
})

// 행사 당일: 신청 마감이 지나 스스로 취소할 수 없고, 입금이 확인됐다.
const dayof = sample({
  name: 'dayof',
  form: MAIN_FORM,
  mine: { ...MAIN_MINE, depositConfirmed: true, cancellable: false },
  today: '2027-02-23',
  eventDay: true,
})

const BACK = { label: '돌아가기', href: null } as const

// closed 견본은 main을 받지 않는 상태로 바꾼 것이다. 취소된 행사·새 설문으로 이동은 서버 상태가 없어 '마감'으로 둔다(v0는 마감 카드).
function closedSample(
  name: ClosedDataName,
  status: Exclude<PublicRegistrationForm['status'], 'open'>,
  over: Partial<FormClosed> = {},
  opensAt: string | null = null,
) {
  const form: PublicRegistrationForm = {
    ...MAIN_FORM,
    status,
    remaining: status === 'full' ? 0 : MAIN_FORM.remaining,
    form: { ...MAIN_FORM.form, opensAt },
  }
  const closed: FormClosed = {
    kind: name,
    title: STATUS_LABEL[status],
    line: closedLine(form) ?? '',
    action: BACK,
    ...over,
  }
  return sample({ name, form, mine: MAIN_MINE, closed })
}

export const FORM_DATA: Record<FormSampleName, FormSample> = {
  main,
  free,
  long,
  dayof,
  full: closedSample('full', 'full'),
  before: closedSample('before', 'before_open', {}, '2026-11-01T10:00'),
  paused: closedSample('paused', 'paused'),
  ended: closedSample('ended', 'closed'),
  cancelled: closedSample('cancelled', 'closed', {
    title: '취소된 행사',
    line: '행사가 취소되어 신청을 받지 않아요.',
  }),
  moved: closedSample('moved', 'closed', {
    title: '새 설문으로 이동',
    line: '신청 양식이 새 설문으로 바뀌었어요. 새 설문에서 다시 신청해 주세요.',
    action: { label: '새 설문으로 이동', href: '/apply/NEWF0RM2' },
  }),
}
