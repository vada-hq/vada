import { dateFromKorean, dDayOf, type EventReportFacts, type RetrospectiveState } from '@vada/contracts'
import type { Stat } from '@/components/StatGrid'
import type { Tone } from '@/components/ui/badge'
import { won } from '../public/registration-text'

// 기록 목록과 결과보고서(M5b·M5c)가 같이 쓰는 표시용 글. API를 부르지 않는다.
// 기록 목록의 회고 칩(M5c). 회고가 없으면 칩이 없다.
export const retrospectiveLabels: Record<RetrospectiveState, string> = { draft: '회고 초안', confirmed: '회고 확인' }
export const retrospectiveTones: Record<RetrospectiveState, Tone> = { draft: 'warning', confirmed: 'success' }
// ISO 시각 → "2026. 10. 12."(한국 날짜)
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
// 한국 시각 "2026-03-06T10:00" → "2026. 3. 6."
export const eventDayText = (startsAt: string | null) => startsAt ? dayOf(dateFromKorean(startsAt).toISOString()) : '날짜 미정'
// 한국 날짜 "2026-02-14" → "2월 14일"
export const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// ISO 시각 → 한국 날짜 "2026-02-14"
export const koreanDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
// 준비 과정의 날짜 묶음: "D-20 · 2월 14일". 행사 날짜가 없으면 날짜만 적는다.
export const dayHeading = (day: string, eventDay: string | null) => eventDay ? `${dDayOf(day, eventDay)} · ${monthDay(day)}` : monthDay(day)
// "담당 기획부 · 책임자 정민재". 정한 것만 적고, 아무것도 없으면 null이다.
export function ownerText(owner: EventReportFacts['owner']) {
  const parts = [owner.department && `담당 ${owner.department}`, owner.person && `책임자 ${owner.person}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
const percent = (part: number, whole: number) => `${Math.round(part / whole * 100)}%`
// 결과보고서 숫자 카드(신청→참석, 예산→집행, 업무, 구매)
export function factStats({ registrations, finance, tasks, purchases }: EventReportFacts): Stat[] {
  return [
    registrations ? { label: '신청 → 참석', value: `${registrations.registered}명 → ${registrations.attended}명`,
      note: registrations.registered > 0 ? `참석률 ${percent(registrations.attended, registrations.registered)}` : undefined }
      : { label: '신청 → 참석', value: '신청 안 받음' },
    finance.budget === null ? { label: '예산 → 집행', value: `집행 ${won(finance.spent)}`, note: '예산 미정' }
      : { label: '예산 → 집행', value: `${won(finance.budget)} → ${won(finance.spent)}`,
        note: finance.budget > 0 ? `집행률 ${percent(finance.spent, finance.budget)}` : undefined },
    tasks.total ? { label: '업무', value: `완료 ${tasks.done}/${tasks.total}건`, note: tasks.late ? `지연 ${tasks.late}건` : '지연 없음' }
      : { label: '업무', value: '업무 없음' },
    { label: '구매', value: `요청 ${purchases.requested}건 · 승인 ${purchases.approved}건` },
  ]
}
// 기록 목록 카드의 숫자 칩(REC-01). 셀 것이 없으면 뺀다.
export function recordChips({ registrations, finance, tasks }: EventReportFacts) {
  return [
    registrations && `참석 ${registrations.attended}명 (신청 ${registrations.registered}명)`,
    finance.budget ? `예산 집행 ${percent(finance.spent, finance.budget)}` : finance.spent ? `집행 ${won(finance.spent)}` : null,
    tasks.total ? `완료 업무 ${tasks.done}건` : null,
  ].filter((chip): chip is string => Boolean(chip))
}
const messages: Record<string, string> = {
  EVENT_NOT_COMPLETED: '완료하지 않은 행사예요. 행사를 다시 완료하면 회고를 만들거나 고칠 수 있어요.',
  VERSION_CONFLICT: '다른 사람이 먼저 바꿨어요. 새로 불러와 주세요.',
  INVALID_STATE: '이미 바뀌었어요. 새로 불러와 주세요.',
  GENERATION_IN_PROGRESS: '끼룩이가 이미 이 회고를 만들고 있어요. 잠시 뒤 새로 불러와 주세요.',
  GENERATION_FAILED: '끼룩이가 초안을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  AI_NOT_CONFIGURED: '지금은 끼룩이를 쓸 수 없어요.',
  FORBIDDEN: '권한이 없어요. 회고는 부서가 있는 구성원이 만들고 고쳐요.',
  NOT_FOUND: '행사를 찾을 수 없어요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
}
export const reportMessage = (code: string | null) => (code && messages[code]) || '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
// 화면이 오래된 경우다. [새로 불러오기]를 보인다. 응답을 못 받았을 때(UNKNOWN)도 서버는 만들었을 수 있다.
export const staleReportCodes = new Set(['VERSION_CONFLICT', 'INVALID_STATE', 'EVENT_NOT_COMPLETED', 'GENERATION_IN_PROGRESS', 'UNKNOWN'])
