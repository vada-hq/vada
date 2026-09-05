import type { Db } from '../db/client.ts'
import { joinParts } from '../finance/labels.ts'
import { clock, day, weekdayStamp } from '../time.ts'
import {
  archiveOf,
  departmentNameOf,
  memberNameOf,
  type ArchiveEvent,
  type ArchiveRow,
} from './archive-facts.ts'
import { handoverGroups, retroGroups, type HandoverGroup, type RetroGroup } from './archive-text.ts'
import { ARCHIVE, type ArchiveStatus } from './completed.ts'

// 아카이브 문서 자체와 사람이 쓰는 부분(REC-02 · REC-02A).
//
// 자동으로 채워지는 본문은 `archive-body.ts`가 든다(굳은 값과 지금 값의 갈림이 거기
// 있다). 여기 있는 것은 **문서의 머리**(이름·상태·누가 언제), **목차**, **사람이 쓴
// 칸**과 그것을 줄로 편 회고·인수인계, 그리고 **발행 조건**이다.
//
// ## 발행 조건은 그림이 든다 — 여섯 줄
//
// 명세의 조각은 모양만 말하고(줄·색), 무엇을 채워야 하는지는 REC-02A가 여섯 줄로
// 그려 두었다. 전부 사람이 쓰는 칸이 비었는지로 답한다 — 자동으로 채워지는 부분은
// 조건이 아니다. **딱지의 수와 목록의 색이 한 셈에서 나온다**(`conditionsOf`).
// 그림에 검토자 줄은 없고, 검토 단계 자체가 명세에서 빠진다(2026-09-05 밤).
//
// ## 상태의 말은 완료된 행사 목록과 같다
//
// REC-01의 줄이 '인수인계 문서 미발행'이라 부른 문서를 REC-02A가 열면 같은 말이어야
// 한다 — 그래서 `completed.ts`의 표를 그대로 쓴다. 그림이 그린 '발행 v1.0'의 판은
// 표에 열이 없어 지어낼 수 없고, 목록이 이미 '발행 완료'로 부른다.

/**
 * AI 초안이 무엇을 하고 무엇을 하지 않는지.
 *
 * **화면에 적힌 이 글이 곧 그 동작의 계약이다**(REC-02A 30:4211). 명세가 이 문장을
 * 들면 초안이 하는 일이 바뀔 때 명세가 틀린다 — 그래서 서버가 든다(`meeting.minutes`의
 * aiDisclaimer와 같은 자리).
 */
const AI_DISCLAIMER =
  'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.'

function word(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function statusOf(row: ArchiveRow | null): ArchiveStatus {
  return (row?.status ?? 'draft') as ArchiveStatus
}

export interface RecordArchive {
  title: string
  statusLabel: string
  statusTone: string
  scheduleNote?: string
  ownerNote?: string
  publishedNote?: string
  authorNote?: string
  nextOwnerNote?: string
  aiDisclaimer?: string
}

/** `2026. 05. 28 (목) 11:00–17:00`. 요일은 시간대를 아는 곳(`time.ts`)이 만든 것에서 집는다. */
function scheduleNoteOf(event: ArchiveEvent): string {
  if (event.startAt === null) return '일시 미정'
  const weekday = /\((.+?)\)/.exec(weekdayStamp(event.startAt))?.[1] ?? ''
  const start = `${day(event.startAt)} (${weekday}) ${clock(event.startAt)}`
  if (event.endAt === null) return start
  return day(event.endAt) === day(event.startAt)
    ? `${start}–${clock(event.endAt)}`
    : `${start}–${day(event.endAt)} ${clock(event.endAt)}`
}

/**
 * 문서 자체(`record.archive`).
 *
 * 쓰는 화면은 이름과 상태만 읽고(그리고 AI 계약 문장), 발행된 문서는 누가 언제 쓰고
 * 발행했는지까지 읽는다 — '발행된 문서에만 온다'는 조각은 발행 전에는 오지 않는다.
 * 검토자 조각(`reviewerNote`)은 검토 단계가 명세에서 빠지므로 내지 않는다.
 */
export async function recordArchive(db: Db, orgId: string, eventId: string): Promise<RecordArchive> {
  const { event, row } = await archiveOf(db, orgId, eventId)
  const status = statusOf(row)
  const drawn: RecordArchive = {
    // 문서의 이름이 비어 있으면 행사 이름이 곧 문서의 이름이다.
    title: word(row?.title) ?? event.title,
    statusLabel: ARCHIVE[status].label,
    statusTone: ARCHIVE[status].tone,
  }
  if (status !== 'published') {
    drawn.aiDisclaimer = AI_DISCLAIMER
    return drawn
  }
  drawn.scheduleNote = scheduleNoteOf(event)
  drawn.ownerNote =
    joinParts([
      event.hostDepartment,
      event.hostMember === null ? null : `책임자 ${event.hostMember}`,
    ]) || '담당 미정'
  if (row?.publishedAt) drawn.publishedNote = `발행 ${day(row.publishedAt)}`
  const author = await memberNameOf(db, orgId, row?.authorMemberId ?? null)
  if (author !== null) drawn.authorNote = `작성 ${author}`
  const nextOwner = word(row?.nextOwner)
  if (nextOwner !== null) drawn.nextOwnerNote = `다음 담당: ${nextOwner}`
  return drawn
}

export interface ConditionRow {
  key: string
  label: string
  met: string
  tone: string
}

/**
 * 그림이 그린 여섯 조건(REC-02A 30:4237). 전부 사람이 쓰는 칸이 비었는지다.
 */
const CONDITIONS = [
  { key: 'onSite', label: '현장 운영 기록', field: 'onSiteOperation' },
  { key: 'retroGood', label: '회고 · 잘된 점', field: 'retroGood' },
  { key: 'retroIssues', label: '회고 · 미흡했던 점과 원인', field: 'retroIssues' },
  { key: 'retroImprovements', label: '회고 · 다음 행사 개선안', field: 'retroImprovements' },
  { key: 'handover', label: '인수인계 내용', field: 'handover' },
  { key: 'nextOwner', label: '다음 담당자 지정', field: 'nextOwner' },
] as const

type ConditionKey = (typeof CONDITIONS)[number]['key']

const MET = { met: 'y', tone: 'green' } as const
const UNMET = { met: '', tone: 'orange' } as const

/** 조건 목록과 채운 수가 **여기 한 셈**에서 나온다. */
function conditionsOf(row: ArchiveRow | null): Array<ConditionRow & { key: ConditionKey }> {
  return CONDITIONS.map((condition) => ({
    key: condition.key,
    label: condition.label,
    ...(word(row?.[condition.field]) === null ? UNMET : MET),
  }))
}

export async function archiveGateConditions(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<ConditionRow[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return conditionsOf(row)
}

export interface ArchiveGate {
  metCountNote: string
  blockedNote?: string
}

/**
 * 다음 단계로 넘길 수 있는가(REC-02A의 단추가 읽는다).
 *
 * **같은 목록을 세어서 답한다.** 조건이 늘거나 줄면 수도 함께 움직인다. 이미 발행된
 * 문서는 조건과 상관없이 다시 넘길 수 없다 — 발행은 한 번이다.
 */
export async function archiveGate(db: Db, orgId: string, eventId: string): Promise<ArchiveGate> {
  const { row } = await archiveOf(db, orgId, eventId)
  const conditions = conditionsOf(row)
  const unmet = conditions.filter((condition) => condition.met === '').length
  const gate: ArchiveGate = { metCountNote: `${conditions.length - unmet} / ${conditions.length}` }
  if (statusOf(row) === 'published') gate.blockedNote = '이미 발행된 문서입니다.'
  else if (unmet > 0) gate.blockedNote = `아직 채우지 않은 발행 조건이 ${unmet}개 있습니다.`
  return gate
}

export interface SectionRow {
  key: string
  label: string
  statusLabel?: string
  statusTone?: string
  rows?: Array<{ key: string; label: string }>
}

/** 저절로 채워지는 절. 쓰는 화면이 '자동'이라 그렸다. */
const AUTO = { statusLabel: '자동', statusTone: 'gray' } as const

/**
 * 사람이 쓰는 절과 그 절을 채우는 조건. 절의 진행 상태가 발행 조건과 같은 셈에서
 * 나오게 한다 — 따로 세면 목차는 '작성 완료'인데 조건은 빨간 날이 온다.
 */
const WRITTEN_SECTIONS: Array<{ key: string; label: string; conditions: ConditionKey[] }> = [
  { key: 'onSite', label: '현장 운영', conditions: ['onSite'] },
  { key: 'retro', label: '회고', conditions: ['retroGood', 'retroIssues', 'retroImprovements'] },
  { key: 'handover', label: '인수인계', conditions: ['handover', 'nextOwner'] },
]

/**
 * 절이 어디까지 왔는가. 그림은 '작성 전'만 그렸다 — 다 쓴 절과 쓰다 만 절의 말은
 * 여기서 정했다(회의록 정리 현황이 '작성 전'·'초안 작성'으로 가르는 것과 같은 결).
 */
function progressOf(metCount: number, total: number): { statusLabel: string; statusTone: string } {
  if (metCount === 0) return { statusLabel: '작성 전', statusTone: 'orange' }
  if (metCount === total) return { statusLabel: '작성 완료', statusTone: 'green' }
  return { statusLabel: '작성 중', statusTone: 'orange' }
}

/** 발행된 문서의 목차. 회고만 세 갈래로 펴진다(REC-02 30:3615). */
const PUBLISHED_SECTIONS: SectionRow[] = [
  { key: 'overview', label: '개요' },
  { key: 'outcome', label: '성과' },
  { key: 'timeline', label: '타임라인' },
  { key: 'onSite', label: '현장 운영' },
  { key: 'evidence', label: '근거 자료' },
  {
    key: 'retro',
    label: '회고',
    rows: [
      { key: 'retroGood', label: '잘된 점' },
      { key: 'retroIssues', label: '미흡했던 점' },
      { key: 'retroImprovements', label: '개선안' },
    ],
  },
  { key: 'handover', label: '인수인계' },
]

/**
 * 목차(`record.archiveSections`). **두 화면이 같은 목록을 다르게 그린다** — 발행된
 * 문서는 회고가 세 갈래로 펴지고, 쓰는 중인 문서는 절마다 어디까지 썼는지가 붙는다.
 * 절의 차례도 그림마다 다르다(쓰는 화면은 자동 넷을 먼저 둔다).
 */
export async function archiveSections(db: Db, orgId: string, eventId: string): Promise<SectionRow[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  if (statusOf(row) === 'published') return PUBLISHED_SECTIONS
  const met = new Set(
    conditionsOf(row)
      .filter((condition) => condition.met !== '')
      .map((condition) => condition.key),
  )
  return [
    { key: 'overview', label: '개요', ...AUTO },
    { key: 'outcome', label: '성과', ...AUTO },
    { key: 'timeline', label: '타임라인', ...AUTO },
    { key: 'evidence', label: '근거 자료', ...AUTO },
    ...WRITTEN_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      ...progressOf(
        section.conditions.filter((key) => met.has(key)).length,
        section.conditions.length,
      ),
    })),
  ]
}

export interface ArchiveDraft {
  onSiteOperation?: string
  retroGood?: string
  retroIssues?: string
  retroImprovements?: string
  improvementDepartment?: string
  handover?: string
  nextOwner?: string
}

/**
 * 사람이 쓰는 칸들(`record.archiveDraft`).
 *
 * **칸은 칸으로 준다.** 안 적은 칸은 아예 오지 않는다 — 빈 글이나 '미정' 같은 말을
 * 넣으면 사람이 그것을 지우지 않고 저장한다. 줄이 없는 문서는 빈 초안이라 아무것도 없다.
 * 검토자 칸은 검토 단계가 빠지므로 내지 않는다.
 */
export async function archiveDraft(db: Db, orgId: string, eventId: string): Promise<ArchiveDraft> {
  const { row } = await archiveOf(db, orgId, eventId)
  const draft: ArchiveDraft = {}
  // 적힌 글은 **적힌 그대로** 돌려준다 — 칸에 되돌아가는 값이라 앞뒤를 다듬으면 사람이
  // 쓴 것과 달라진다. 비었는지만 본다.
  const put = (key: keyof ArchiveDraft, value: string | null | undefined) => {
    if (word(value) !== null) draft[key] = value as string
  }
  put('onSiteOperation', row?.onSiteOperation)
  put('retroGood', row?.retroGood)
  put('retroIssues', row?.retroIssues)
  put('retroImprovements', row?.retroImprovements)
  put('improvementDepartment', row?.improvementDepartmentId)
  put('handover', row?.handover)
  put('nextOwner', row?.nextOwner)
  return draft
}

/**
 * 회고(`record.archiveRetro`). 글의 줄이 곧 줄이다 — 규칙은 `archive-text.ts`가 든다.
 * 개선안의 담당 부서는 이 학생회의 부서일 때만 이름이 붙는다.
 */
export async function archiveRetro(db: Db, orgId: string, eventId: string): Promise<RetroGroup[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return retroGroups(
    {
      retroGood: row?.retroGood ?? null,
      retroIssues: row?.retroIssues ?? null,
      retroImprovements: row?.retroImprovements ?? null,
    },
    await departmentNameOf(db, orgId, row?.improvementDepartmentId ?? null),
  )
}

/** 인수인계(`record.archiveHandover`). 다음 담당자는 문서 전체의 것이라 `record.archive`가 든다. */
export async function archiveHandover(db: Db, orgId: string, eventId: string): Promise<HandoverGroup[]> {
  const { row } = await archiveOf(db, orgId, eventId)
  return handoverGroups(row?.handover)
}
