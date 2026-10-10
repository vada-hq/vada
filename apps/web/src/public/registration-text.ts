import type { RegistrationState } from '@vada/contracts'

// 참가 신청 화면(공개·운영진)이 같이 쓰는 표시용 문구. API를 부르지 않는다.
const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const numbers = (value: string) => value.split(/[-:]/).map(Number)
// "18:00" → "오후 6:00"
function clock(time: string) {
  const [hour = 0, minute = 0] = numbers(time)
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')}`
}
function monthDay(date: string) {
  const [year = 0, month = 1, day = 1] = numbers(date)
  return `${month}월 ${day}일 (${weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]})`
}
// 한국 시각 "2026-08-20T10:00" → "8월 20일 (목) 오전 10:00". 문자열을 그대로 읽으므로 기기 시간대와 상관없다.
export const formatKoreanTime = (value: string) => `${monthDay(value.slice(0, 10))} ${clock(value.slice(11))}`
// "2026-09-19" → "2026년 9월 19일"
export function dayText(date: string) {
  const [year, month, day] = numbers(date)
  return `${year}년 ${month}월 ${day}일`
}
// "01012345678" → "010-1234-5678"
export const phoneText = (phone: string) => phone.length === 11
  ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
// 같은 날 끝나면 끝 시각만 적는다.
export function eventTimeText(startsAt: string | null, endsAt: string | null) {
  if (!startsAt) return null
  if (!endsAt) return formatKoreanTime(startsAt)
  const end = endsAt.slice(0, 10) === startsAt.slice(0, 10) ? clock(endsAt.slice(11)) : formatKoreanTime(endsAt)
  return `${formatKoreanTime(startsAt)} ~ ${end}`
}

const labels: Record<RegistrationState, string> = { open: '받는 중', upcoming: '시작 전', closed: '마감', full: '정원 참', paused: '멈춤' }
export const stateLabel = (state: RegistrationState) => labels[state]
// 받는 중이 아닐 때 공개 화면이 입력 칸 대신 보여 주는 안내
export function stateText(state: RegistrationState, opensAt: string | null): { title: string; description: string } | null {
  switch (state) {
    case 'open': return null
    case 'upcoming': return { title: '아직 신청 기간이 아니에요', description: opensAt ? `${formatKoreanTime(opensAt)}부터 신청할 수 있어요.` : '곧 신청을 받아요.' }
    case 'closed': return { title: '신청이 마감됐어요', description: '참가 신청 기간이 끝났어요.' }
    case 'full': return { title: '정원이 다 찼어요', description: '신청 정원이 모두 찼어요.' }
    case 'paused': return { title: '지금은 신청을 받지 않아요', description: '학생회가 신청 받기를 잠시 멈췄어요.' }
  }
}

const messages: Record<string, string> = {
  ALREADY_REGISTERED: '이미 신청한 학번이에요. 신청한 기기에서 내 신청을 확인해 주세요.',
  REGISTRATION_FULL: '정원이 다 찼어요.',
  REGISTRATION_NOT_OPEN: '지금은 신청할 수 없어요.',
  FORM_CHANGED: '신청 설정이 바뀌었어요. 바뀐 내용을 확인하고 다시 신청해 주세요.',
  NOT_FOUND: '신청 정보를 찾을 수 없어요.',
  CANCEL_CLOSED: '마감 뒤에는 취소할 수 없어요. 학생회에 문의해 주세요.',
  VERSION_CONFLICT: '다른 사람이 먼저 바꿨어요. 새로 불러온 내용을 확인해 주세요.',
  EVENT_TIME_REQUIRED: '행사 시작 일시를 먼저 넣어 주세요.',
  DEADLINE_AFTER_EVENT: '신청 마감은 행사가 끝나기 전이어야 해요.',
  REGISTRATION_EXISTS: '이미 참가 신청을 만들었어요. 새로 불러온 내용을 확인해 주세요.',
  FORBIDDEN: '부서가 있는 구성원만 참가 신청을 관리할 수 있어요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
  FEE_LOCKED: '입금을 확인한 신청이 있어 참가비를 바꿀 수 없어요.',
  FEE_ACCOUNT_REQUIRED: '학생회 계좌가 없어 참가비를 받을 수 없어요. 재정 담당자에게 계좌를 넣어 달라고 해 주세요.',
  DUES_ROSTER_REQUIRED: '쓸 수 있는 학생회비 명단이 없어요. 재정 담당자에게 명단을 올려 달라고 해 주세요.',
  EVENT_SETTLED: '정산이 끝난 행사라 참가비와 입금을 바꿀 수 없어요.',
  NO_FEE: '낼 참가비가 없는 신청이에요.',
  PAYMENT_CONFIRMED: '입금을 확인한 신청이라 바꿀 수 없어요. 먼저 입금 확인을 취소해 주세요.',
  PAYMENT_NOT_CONFIRMED: '입금 확인이 이미 취소됐어요. 새로 불러왔어요.',
  INVALID_STATE: '지금 상태에서는 할 수 없어요. 새로 불러왔어요.',
}
// 같은 오류라도 화면마다 알맞은 문구가 다르면 overrides로 바꾼다(예: 공개 화면의 PAYMENT_CONFIRMED).
export const registrationMessage = (code: unknown, overrides: Record<string, string> = {}) =>
  (typeof code === 'string' && (overrides[code] ?? messages[code])) || '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
export const registrationFailure = '연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'

// 입금자명: 이름 + 학번 뒤 4자리. 은행이 입금자명을 자르므로 짧게 정하고, 운영진은 이름이나 학번 일부로 명단을 찾는다.
export const depositorName = (name: string, studentId: string) => `${name}${studentId.slice(-4)}`
export const won = (value: number) => `${value.toLocaleString('ko-KR')}원`

// 공개 신청 화면의 참가비 줄. 무료면 없다.
export function feeLine(fee: number, memberFee: number | null) {
  if (fee === 0 && memberFee === null) return null
  if (memberFee === null) return `참가비 ${won(fee)}`
  return `참가비 ${won(fee)} · 학생회비 납부자 ${memberFee === 0 ? '무료' : won(memberFee)}`
}

// 개인정보 수집·이용 고지(개인정보보호법 제15조 제2항의 네 가지와 받는 곳). 운영진이 고칠 수 없다.
// 참가비가 있으면 목적에 참가비 확인을 넣고, 납부자 참가비가 있으면 학생회비 명단과 맞춰 본다고 알린다.
export const privacyNotice = ({ organizationName, eventName, collectPhone, purgeAfter, fee, memberFee }: { organizationName: string; eventName: string
  collectPhone: boolean; purgeAfter: string; fee: number; memberFee: number | null }) => [
  `받는 곳: ${organizationName}`,
  `목적: ${eventName} 참가 신청 확인${fee > 0 || memberFee !== null ? ', 참가비 확인' : ''}과 행사 운영`,
  `항목: 이름, 학번${collectPhone ? ', 휴대폰 번호' : ''}`,
  ...memberFee === null ? [] : ['학생회비 납부 여부는 이름과 학번을 학생회비 명단과 맞춰 확인해요.'],
  `보유 기간: 행사가 끝나고 30일 뒤(${dayText(purgeAfter)}) 지워요`,
  '동의하지 않을 수 있어요. 다만 동의하지 않으면 신청할 수 없어요.',
]
