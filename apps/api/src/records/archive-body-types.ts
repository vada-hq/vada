export interface ArchiveDetail {
  goal: string
  audience: string
  scheduleAndPlace: string
  owner: string
  scale: string
  attendance: string
  satisfaction: string
  budget: string
  taskCompletion: string
  runOrder: string
  staffing: string
  incident: string
  operationChange: string
}

export interface TimelineRow {
  id: string
  date: string
  title: string
  description: string
}

export interface EvidenceRow {
  id: string
  title: string
  detail: string
  actionLabel?: string
  targetKind?: string
}

export interface AutoFilled {
  overview: string
  outcome: string
  timeline: string
  evidence: string
}

/**
 * 발행 시점에 굳는 것. **네 자리의 응답 모양 그대로다** — 표의 `frozen`이 이 모양이다.
 */
export interface FrozenArchive {
  detail: ArchiveDetail
  timeline: TimelineRow[]
  evidence: EvidenceRow[]
  autoFilled: AutoFilled
}
