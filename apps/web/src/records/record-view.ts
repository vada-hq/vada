import { dateFromKorean, type EventReportFacts, type ReportSection, type ReportStatus } from '@vada/contracts'
import type { Stat } from '@/components/StatGrid'
import type { Tone } from '@/components/ui/badge'
import { won } from '../public/registration-text'

// 기록 목록과 결과보고서(M5b)가 같이 쓰는 표시용 글. API를 부르지 않는다.
export type ReportState = 'none' | ReportStatus
export const reportStateOf = (report: { status: ReportStatus } | null): ReportState => report?.status ?? 'none'
export const reportStateLabels: Record<ReportState, string> = { none: '작성 전', draft: '작성 중', published: '발행' }
export const reportStateTones: Record<ReportState, Tone> = { none: 'neutral', draft: 'warning', published: 'success' }
// 쓰는 화면에서 칸마다 보이는 도움말(REC-02A)
export const sectionHints: Record<ReportSection, string> = {
  operations: '실제 진행 순서, 인력 배치, 돌발 상황과 대응',
  wentWell: '다음에도 그대로 하면 좋을 것',
  shortfalls: '아쉬웠던 점과 그 원인',
  improvements: '다음 행사에서 실제로 할 수 있는 행동',
  handover: '다시 쓸 자료, 협력처·연락처, 주의할 점',
}
// ISO 시각 → "2026. 10. 12."(한국 날짜)
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
// 한국 시각 "2026-03-06T10:00" → "2026. 3. 6."
export const eventDayText = (startsAt: string | null) => startsAt ? dayOf(dateFromKorean(startsAt).toISOString()) : '날짜 미정'
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
  EVENT_NOT_COMPLETED: '완료하지 않은 행사예요. 회장단이 행사를 완료하면 결과보고서를 쓸 수 있어요.',
  REPORT_PUBLISHED: '이미 발행한 결과보고서예요. 고치려면 회장단이 발행을 취소해야 해요.',
  REPORT_INCOMPLETE: '다섯 칸을 모두 써야 발행할 수 있어요.',
  INVALID_STATE: '이미 바뀌었어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 사람이 먼저 저장했어요. 쓴 글을 복사해 두고 새로 불러와 주세요.',
  FORBIDDEN: '권한이 없어요. 쓰기는 부서가 있는 구성원, 발행은 회장단이 해요.',
  NOT_FOUND: '행사를 찾을 수 없어요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
}
export const reportMessage = (code: string | null) => (code && messages[code]) || '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
// 화면이 오래된 경우다. [새로 불러오기]를 보인다.
export const staleReportCodes = new Set(['VERSION_CONFLICT', 'REPORT_PUBLISHED', 'INVALID_STATE', 'EVENT_NOT_COMPLETED', 'REPORT_INCOMPLETE'])
