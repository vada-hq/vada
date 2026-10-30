import {
  DAY_MS,
  KOREAN_DATE_LENGTH,
  koreanDateOf,
  type MyRegistration,
  type PublicRegistrationForm,
  type RegistrationStatus,
} from '@vada/contracts'
import { momentLabel } from '@/events/event-view'
import { monthDay } from '@/lib/korean-date-text'

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  open: '신청 받는 중',
  before_open: '시작 전',
  full: '정원 마감',
  paused: '잠시 멈춤',
  closed: '마감',
}

export const won = (amount: number) =>
  amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`

type Fees = Pick<PublicRegistrationForm, 'payerFee' | 'nonPayerFee'>

// 참가비 줄. 납부자 금액이 다르면 두 줄이다(신청 화면 머리는 한 줄에 하나씩 쌓는다).
// 신청 전에는 두 값만 보인다(어느 쪽인지는 학번을 낸 뒤 정해진다).
export function feeLines({ payerFee, nonPayerFee }: Fees) {
  if (payerFee === null || nonPayerFee === null) return ['무료']
  if (payerFee === nonPayerFee) return [won(payerFee)]
  return [`학생회비 납부자 ${won(payerFee)}`, `미납자 ${won(nonPayerFee)}`]
}

export const feeText = (form: Fees) => feeLines(form).join(' · ')

// 마감이 가까울 때만 붙는 표시. 강조는 객관적 사실(마감 날이 오늘·내일, 한국 날짜)에만 준다(내용: 정보 기준).
export function deadlineMark(closesAt: string, now: Date) {
  const day = closesAt.slice(0, KOREAN_DATE_LENGTH)
  if (day === koreanDateOf(now)) return '오늘 마감'
  if (day === koreanDateOf(new Date(now.getTime() + DAY_MS))) return '내일 마감'
  return null
}

// 신청 화면 고지의 목적. 입금 대조는 참가비가 있는 양식에만 생겨 그때만 입금 확인을 붙인다(DEC-93).
// 학번을 받는 양식은 같은 양식의 중복 신청을 학번으로 막는다(DEC-107).
export function noticePurpose(
  form: Pick<PublicRegistrationForm, 'payerFee' | 'nonPayerFee' | 'collectsStudentId'>,
) {
  const paid = [form.payerFee, form.nonPayerFee].some(fee => (fee ?? 0) > 0)
  return [
    '행사 참가 신청',
    '출석 확인',
    ...(paid ? ['입금 확인'] : []),
    ...(form.collectsStudentId ? ['같은 양식의 중복 신청 확인'] : []),
  ].join(', ')
}

// '2027-10-25' → '2027년 10월 25일'
export const dateText = (date: string) => `${date.split('-')[0]}년 ${monthDay(date)}`

// 받는 중이 아닐 때 칸 대신 보이는 한 줄. 받는 중이면 null이다.
export function closedLine(form: PublicRegistrationForm) {
  switch (form.status) {
    case 'open':
      return null
    case 'before_open':
      return form.form.opensAt === null
        ? '아직 신청을 받지 않아요.'
        : `${momentLabel(form.form.opensAt)}부터 신청할 수 있어요.`
    case 'full':
      return '정원이 다 찼어요.'
    case 'paused':
      return '신청을 잠시 멈췄어요. 다시 열리면 이 링크로 신청할 수 있어요.'
    case 'closed':
      return '신청이 마감됐어요.'
  }
}

// 받는 항목 글. 서버가 받는 칸과 질문 제목을 그대로 적는다(DEC-93: 질문 제목이 고지의 받는 항목에 실린다).
export function collectedItems(
  form: Pick<PublicRegistrationForm, 'collectsStudentId' | 'collectsPhone' | 'questions'>,
) {
  return [
    '이름',
    ...(form.collectsStudentId ? ['학번'] : []),
    ...(form.collectsPhone ? ['휴대폰 번호'] : []),
    ...form.questions.map(question => question.title),
  ]
}

export const inquiryText = (notice: string | null) =>
  notice ? '문의는 위 안내에 적힌 곳으로 해 주세요.' : '문의는 이 링크를 보낸 운영진에게 해 주세요.'

const REAPPLY = '마감 전이면 다시 신청할 수 있어요.'
const ERASED = '취소하면 낸 이름과 연락처가 지워지고, 이 주소로 다시 볼 수 없어요.'

// 스스로 취소하는 창의 고지. 실제 처리(voidRegistration)와 같아야 한다.
// 입금을 확인한 신청은 환불 대기가 되어 환불을 표시할 때까지 이름·휴대폰 번호·입금 금액만 남는다(DEC-55, 개인정보 처리방침 10조).
// 환불 규칙은 학생회가 신청 안내에 적으니(DEC-55) 문의처만 알린다.
// 서버는 취소하는 때의 입금 기록으로 가른다. 이 화면이 읽은 뒤에 입금이 확인될 수 있어, 참가비가 있는 신청에는 지워진다고 잘라 말하지 않는다.
export function cancelNotice({
  appliedFee,
  depositConfirmed,
  mine,
  form,
}: Pick<MyRegistration, 'appliedFee' | 'depositConfirmed' | 'mine' | 'form'>) {
  if (appliedFee === 0 && !depositConfirmed) return `${ERASED} ${REAPPLY}`
  const kept = mine.phone ? '이름·휴대폰 번호·입금 금액' : '이름·입금 금액'
  const refund = form.notice
    ? '환불은 안내에 적힌 곳으로 문의해 주세요.'
    : '환불은 이 링크를 보낸 운영진에게 문의해 주세요.'
  const until = '운영진이 환불을 표시할 때까지 남'
  return depositConfirmed
    ? `취소하면 이 주소로 다시 볼 수 없어요. ${kept}만 ${until}고 나머지는 바로 지워져요. ${refund} ${REAPPLY}`
    : `${ERASED} 다만 입금이 확인된 신청은 ${kept}이 ${until}아요. ${refund} ${REAPPLY}`
}
