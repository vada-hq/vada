import { z } from 'zod'
import type { EventSummary } from './index.js'
import { text } from './input.js'
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

// 결과보고서의 자동 수치와 이름. 작성 중이면 지금 센 값, 발행했으면 발행 때 고정한 값이다.
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
export interface EventReportResponse {
  event: EventSummary
  // 아직 쓰지 않았으면 null이다.
  report: EventReportView | null
  facts: EventReportFacts
  // 수치를 센 시각(ISO). 발행했으면 발행 시각이다.
  factsAt: string
}
export interface EventRecord {
  event: EventSummary
  report: { status: ReportStatus; publishedAt: string | null } | null
  // 발행했으면 발행 때 값, 아니면 지금 센 값
  facts: EventReportFacts
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
