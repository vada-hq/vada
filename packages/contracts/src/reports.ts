import { z } from 'zod'
import type { EventSummary } from './index.js'
import { text, token } from './input.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

// 결과보고서 칸의 상한(M5b). DB CHECK(0026)와 같은 값이다.
export const REPORT_SECTION_MAX = 2000
// 사람이 쓰는 다섯 칸. 화면 순서다.
export const REPORT_SECTIONS = ['operations', 'wentWell', 'shortfalls', 'improvements', 'handover'] as const
export type ReportSection = typeof REPORT_SECTIONS[number]
export const REPORT_SECTION_LABELS: Record<ReportSection, string> = { operations: '현장 운영', wentWell: '잘된 점', shortfalls: '아쉬운 점과 원인',
  improvements: '다음 행사 개선안', handover: '인수인계' }
export type ReportStatus = 'draft' | 'published'

const section = text(REPORT_SECTION_MAX).nullable()
// 다섯 칸을 한 번에 저장한다. 빈 칸은 null이다. 보고서가 없으면 버전 0이다.
export const SaveEventReportSchema = z.strictObject({ version: z.number().int().min(0).max(PURCHASE_INTEGER_MAX), operations: section,
  wentWell: section, shortfalls: section, improvements: section, handover: section })
// 발행·발행 취소. 화면이 본 보고서 버전을 보낸다.
export const PublishEventReportSchema = z.strictObject({ version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX) })
export const UnpublishEventReportSchema = PublishEventReportSchema
export type SaveEventReportRequest = z.infer<typeof SaveEventReportSchema>
export type PublishEventReportRequest = z.infer<typeof PublishEventReportSchema>

// 결과보고서의 숫자와 이름(M5b). 열 때마다 행사 기록에서 센다(완료한 행사는 바뀌지 않는다). 이름은 지금 이름이다.
// 발행한 보고서에 그대로 저장되므로, 칸을 더하면 옛 보고서에는 그 칸이 없을 수 있다.
export interface EventReportFacts {
  event: { name: string; startsAt: string | null; endsAt: string | null; place: string | null }
  // 담당 부서·책임자 이름. 정하지 않았으면 null이다.
  owner: { department: string | null; person: string | null }
  // 신청: 취소하지 않은 신청(보관 기간이 지나 정보를 지운 신청 포함), 참석: 참석을 확인한 신청. 참가 신청을 받지 않았으면 null이다.
  registrations: { registered: number; attended: number } | null
  // 예산: 행사 예산(미정이면 null), 집행: 취소하지 않은 지출 합(재정 탭의 실제 지출)
  finance: { budget: number | null; spent: number }
  // 지연: 마감일이 있고, 마감일(한국 날짜)을 넘겨 끝냈거나 센 날까지 끝내지 않은 업무
  tasks: { total: number; done: number; late: number }
  // 요청: 제출한 품목(반려·취소 포함), 승인: 승인 상태인 품목
  purchases: { requested: number; approved: number }
}
export interface ReportPerson { id: string; name: string }
export interface EventReportView {
  status: ReportStatus
  operations: string | null
  wentWell: string | null
  shortfalls: string | null
  improvements: string | null
  handover: string | null
  version: number
  created: { by: ReportPerson; at: string }
  // 마지막으로 글을 저장한 사람과 때
  updated: { by: ReportPerson; at: string }
  published: { by: ReportPerson; at: string } | null
}
// 완료한 행사, 최근 완료 순
export interface RecordsResponse { records: EventRecord[] }

// 회고(M5c)를 저장하는 꼴. sources는 근거 ID다: 'message:…'(행사 대화), 준비 과정 줄 ID('task:…' 등), 'fact:…'(숫자).
export interface RetrospectiveItem { id: string; text: string; sources: string[] }
export interface RetrospectiveQuestion { id: string; text: string; sources: string[]; answer: string | null }
export interface RetrospectiveContent {
  wentWell: RetrospectiveItem[]
  shortfalls: RetrospectiveItem[]
  nextTime: RetrospectiveItem[]
  questions: RetrospectiveQuestion[]
}

// ── 회고(M5c) ──
// 끼룩이는 섹션마다 5문장·확인 필요 3개까지 만들고, 사람은 섹션마다 10문장까지 저장한다. 근거는 문장마다 8개까지다.
export const RETRO_TEXT_MAX = 200
export const RETRO_ANSWER_MAX = 300
export const RETRO_ITEMS_MAX = 10
export const RETRO_GENERATED_MAX = 5
export const RETRO_QUESTIONS_MAX = 3
export const RETRO_SOURCES_MAX = 8
export const RETRO_SECTIONS = ['wentWell', 'shortfalls', 'nextTime'] as const
export type RetroSection = typeof RETRO_SECTIONS[number]
export const RETRO_SECTION_LABELS: Record<RetroSection, string> = { wentWell: '잘된 점', shortfalls: '아쉬운 점', nextTime: '다음 행사에서' }

const retroVersion = (min: number) => z.number().int().min(min).max(PURCHASE_INTEGER_MAX)
// 회고가 없으면 0, 다시 만들면 지금 버전이다.
export const GenerateRetrospectiveSchema = z.strictObject({ version: retroVersion(0) })
export const ConfirmRetrospectiveSchema = z.strictObject({ version: retroVersion(1) })
// 있던 문장은 ID로, 새 문장은 null로 보낸다. 확인 필요는 더할 수 없고, 보내지 않으면 지운다.
const retroSentences = z.array(z.strictObject({ id: token(64).nullable(), text: text(RETRO_TEXT_MAX) })).max(RETRO_ITEMS_MAX)
export const SaveRetrospectiveSchema = z.strictObject({
  version: retroVersion(1), wentWell: retroSentences, shortfalls: retroSentences, nextTime: retroSentences,
  questions: z.array(z.strictObject({ id: token(64), answer: text(RETRO_ANSWER_MAX).nullable() })).max(RETRO_QUESTIONS_MAX),
})
export type GenerateRetrospectiveRequest = z.infer<typeof GenerateRetrospectiveSchema>
export type SaveRetrospectiveRequest = z.infer<typeof SaveRetrospectiveSchema>
export type ConfirmRetrospectiveRequest = z.infer<typeof ConfirmRetrospectiveSchema>

// 준비 과정(M5c): 완료한 행사의 기록에서 서버가 만든 줄. 사람 이름은 없고 부서만 있다.
export type RecordTab = 'chat' | 'tasks' | 'purchases' | 'registrations' | 'finance'
export type RecordEntryKind = 'event' | 'registration' | 'task' | 'purchase' | 'expense' | 'finance'
export interface RecordEntry {
  // 'task:…', 'submission:…', 'approved:2026-03-02' 같은 ID. 회고의 근거가 가리킨다.
  id: string
  // 한국 날짜 YYYY-MM-DD
  day: string
  // ISO 시각. 날짜만 있는 줄(지출 결제일, 끝내지 않은 업무의 마감일)은 null이고 그날 맨 앞에 둔다.
  at: string | null
  kind: RecordEntryKind
  text: string
  note: string | null
  // 늦은 업무, 반려, 영수증 없음처럼 눈여겨볼 줄
  warning: boolean
  // 누르면 갈 행사 탭. 행사 자체 줄은 null이다.
  tab: RecordTab | null
}
// 준비 과정의 날짜를 행사 시작일 기준으로 적는다: 'D-20', 'D-day', 'D+3'. 둘 다 한국 날짜(YYYY-MM-DD)다.
export function dDayOf(day: string, eventDay: string) {
  const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${eventDay}T00:00:00Z`)) / 86_400_000)
  return diff === 0 ? 'D-day' : diff < 0 ? `D${diff}` : `D+${diff}`
}

// 회고 문장의 근거를 화면에 바로 쓰는 꼴. 지금 찾을 수 없으면 missing이다.
export type RetrospectiveSource =
  | { kind: 'message'; messageId: string; excerpt: string; at: string }
  | { kind: 'entry'; id: string; text: string; tab: RecordTab | null }
  | { kind: 'fact'; id: string; text: string }
  | { kind: 'missing' }
export interface RetrospectiveItemView { id: string; text: string; sources: RetrospectiveSource[] }
export interface RetrospectiveQuestionView extends RetrospectiveItemView { answer: string | null }
export interface RetrospectiveView {
  wentWell: RetrospectiveItemView[]
  shortfalls: RetrospectiveItemView[]
  nextTime: RetrospectiveItemView[]
  questions: RetrospectiveQuestionView[]
  version: number
  generated: { by: ReportPerson; at: string }
  // 확인(또는 고쳐 저장)한 사람·때. 확인 전에는 null이다.
  confirmed: { by: ReportPerson; at: string } | null
  // 초안을 만든 뒤 완료를 취소했다가 다시 완료했거나, 지금 완료하지 않았다.
  stale: boolean
}
export type RetrospectiveState = 'draft' | 'confirmed'

export interface EventReportResponse {
  event: EventSummary
  facts: EventReportFacts
  timeline: RecordEntry[]
  // 회고가 없으면 null이다.
  retrospective: RetrospectiveView | null
}
export interface EventRecord {
  event: EventSummary
  facts: EventReportFacts
  retrospective: RetrospectiveState | null
}
