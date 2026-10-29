import type { PublicRegistrationForm, RegistrationStatus } from '@vada/contracts'
import { momentLabel } from '@/events/event-view'
import { monthDay } from '@/lib/korean-date-text'

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  open: '신청 받는 중',
  before_open: '시작 전',
  full: '정원 마감',
  paused: '잠시 멈춤',
  closed: '마감',
}
export const STATUS_TONE: Record<RegistrationStatus, 'success' | 'info' | 'warning' | 'neutral'> = {
  open: 'success',
  before_open: 'info',
  full: 'warning',
  paused: 'warning',
  closed: 'neutral',
}

export const won = (amount: number) =>
  amount === 0 ? '무료' : `${amount.toLocaleString('ko-KR')}원`

// 신청 전에는 참가비 두 값만 보인다(어느 쪽인지는 학번을 낸 뒤 정해진다).
export function feeText(form: Pick<PublicRegistrationForm, 'payerFee' | 'nonPayerFee'>) {
  const { payerFee, nonPayerFee } = form
  if (payerFee === null || nonPayerFee === null) return '무료'
  if (payerFee === nonPayerFee) return won(payerFee)
  return `학생회비 납부자 ${won(payerFee)} · 미납자 ${won(nonPayerFee)}`
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
