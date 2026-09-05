import type { Db } from '../db/client.ts'
import { joinParts, won } from '../finance/labels.ts'
import { clock, day } from '../time.ts'
import {
  archiveFacts,
  archiveOf,
  type ArchiveEvent,
  type ArchiveFacts,
  type ArchiveRow,
} from './archive-facts.ts'

// 아카이브의 **자동으로 채워지는 본문** — 개요·성과·현장 운영의 열세 조각, 타임라인,
// 근거 자료, 자동 채움 네 줄(REC-02 · REC-02A).
//
// ## 갈림은 한 곳이다
//
// 발행 전에는 읽을 때마다 표에서 지금 값으로 만들고, 발행된 문서는 그때 굳힌 값
// (`event_archives.frozen`)에서 읽는다 — 명세가 '위 수치는 발행 시점 기준입니다.
// 원본이 이후 변경되어도 이 문서는 바뀌지 않습니다'라고 적었다. 그 갈림을 `archiveBody`
// 하나에 두고 네 자리가 전부 여기서 집어 간다. 자리마다 갈리면 하나는 언젠가 지금
// 값을 낸다.
//
// **굳히는 함수도 여기 있다**(`freezeArchive`). 발행하는 변이는 검토자가 승인하는
// 자리가 그려진 뒤에 짓는데, 그때 이 함수가 만든 것을 `frozen`에 넣으면 된다 —
// 읽는 모양과 굳히는 모양이 한 파일에 있어야 둘이 갈리지 않는다.
//
// ## 없는 것은 없다고 말한다
//
// 열세 조각은 전부 칸이 잡힌 자리라 빈 글로라도 와야 하고, 빈 글을 주면 화면이 빈 칸을
// 그린다. 그래서 표에 없는 것은 그 사실을 말로 준다. 만족도는 담는 표가 없고(그 사실을
// 말한다), 현장 운영은 사람이 한 칸에 쓰는데 그림은 네 칸으로 갈라 두었다 — 글에 없는
// 구조를 지어내지 않고 첫 칸에 그대로 두고 나머지 셋은 어디에 있는지를 말한다.

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

/** 그림이 그린 근거 자료 네 종류. 열쇠는 명세가 갈 곳을 정한 그 값이다(itemAction.targets). */
const EVIDENCE_KINDS = [
  { id: 'tasks', title: '행사 업무', short: '업무' },
  { id: 'meetings', title: '관련 회의', short: '회의' },
  { id: 'documents', title: '행사 문서', short: '문서' },
  { id: 'finance', title: '정산', short: '구매' },
] as const

const OPEN_SOURCE = '원본 보기 →'

/** 현장 운영 글이 있을 때, 넷으로 안 갈린 나머지 세 칸에 오는 말. */
const IN_ON_SITE = '현장 운영 기록에 함께 적혀 있습니다'

function word(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? null : trimmed
}

function percent(part: number, whole: number): number {
  return Math.round((part / whole) * 100)
}

/**
 * 이 문서의 자동 본문. **굳은 값이 있으면 그것이고, 없으면 지금 값이다.**
 */
export async function archiveBody(
  db: Db,
  orgId: string,
  eventId: string,
  now: Date,
): Promise<FrozenArchive> {
  const archive = await archiveOf(db, orgId, eventId)
  const frozen = archive.row?.frozen
  if (frozen !== null && frozen !== undefined) return asFrozen(frozen)
  return liveBody(db, orgId, archive.event, archive.row, now)
}

/**
 * 지금 값을 계약의 모양으로 굳힌다. **발행하는 변이가 이것을 `frozen`에 넣는다.**
 *
 * 굳은 값이 이미 있어도 늘 지금 값을 본다 — 굳히는 일과 읽는 일은 다른 물음이다.
 * 표에 쓰지는 않는다: 언제 누가 발행했는지와 함께 한 번에 써야 하고 그것은 발행
 * 변이의 일이다.
 */
export async function freezeArchive(
  db: Db,
  orgId: string,
  eventId: string,
  now: Date,
): Promise<FrozenArchive> {
  const archive = await archiveOf(db, orgId, eventId)
  return liveBody(db, orgId, archive.event, archive.row, now)
}

export const archiveDetail = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).detail
export const archiveTimeline = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).timeline
export const archiveEvidence = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).evidence
export const archiveAutoFilled = async (db: Db, orgId: string, eventId: string, now: Date) =>
  (await archiveBody(db, orgId, eventId, now)).autoFilled

/**
 * 표에 든 굳은 값이 계약의 모양인가.
 *
 * **모양이 다르면 터뜨린다.** 조용히 지금 값으로 대신하면 발행된 문서가 원본을 따라
 * 바뀌는데 아무도 모른다 — 그것이 이 자리가 막으려는 바로 그 일이다.
 */
function asFrozen(value: unknown): FrozenArchive {
  const frozen = value as Partial<FrozenArchive> | null
  if (
    frozen === null ||
    typeof frozen !== 'object' ||
    typeof frozen.detail !== 'object' ||
    frozen.detail === null ||
    !Array.isArray(frozen.timeline) ||
    !Array.isArray(frozen.evidence) ||
    typeof frozen.autoFilled !== 'object' ||
    frozen.autoFilled === null
  ) {
    throw new Error('아카이브의 굳은 값이 계약의 모양이 아닙니다')
  }
  return {
    detail: frozen.detail,
    timeline: frozen.timeline,
    evidence: frozen.evidence,
    autoFilled: frozen.autoFilled,
  }
}

interface Node {
  id: string
  at: Date
  title: string
  description: string
}

async function liveBody(
  db: Db,
  orgId: string,
  event: ArchiveEvent,
  row: ArchiveRow | null,
  now: Date,
): Promise<FrozenArchive> {
  const facts = await archiveFacts(db, orgId, event.id, now)
  const nodes = nodesOf(event, facts)
  return {
    detail: detailOf(event, row, facts),
    timeline: nodes.map((node) => ({
      id: node.id,
      // `04. 12` — 연도 없이. 그림이 그렇게 그렸고 문서의 머리가 해를 든다.
      date: day(node.at).slice(6),
      title: node.title,
      description: node.description,
    })),
    evidence: evidenceOf(facts),
    autoFilled: autoFilledOf(event, facts, nodes),
  }
}

/** `2026. 05. 28 11:00–17:00`. 끝이 다른 날이면 그 날까지 적는다. */
function whenOf(event: ArchiveEvent): string {
  if (event.startAt === null) return '일시 미정'
  const start = `${day(event.startAt)} ${clock(event.startAt)}`
  if (event.endAt === null) return start
  return day(event.endAt) === day(event.startAt)
    ? `${start}–${clock(event.endAt)}`
    : `${start}–${day(event.endAt)} ${clock(event.endAt)}`
}

/** 안 적은 것과 안 정하기로 한 것은 다른 사실이다 — 표가 그 둘을 갈라 둔다. */
function whereOf(event: ArchiveEvent): string {
  return word(event.place) ?? (event.placeUnset ? '장소 없음' : '장소 미정')
}

function capacityNote(event: ArchiveEvent): string | null {
  if (event.capacityType === 'unlimited') return '정원 제한 없음'
  if (event.capacityCount !== null) return `정원 ${event.capacityCount}명`
  const written = word(event.capacity)
  return written === null ? null : `정원 ${written}`
}

/** `2명 참석 (신청 3명)` — 완료된 행사 목록과 같은 말. 둘 다 없으면 없다. */
function attendanceMark(facts: ArchiveFacts): string | null {
  return facts.checkIns > 0 || facts.applications > 0
    ? `${facts.checkIns}명 참석 (신청 ${facts.applications}명)`
    : null
}

function detailOf(event: ArchiveEvent, row: ArchiveRow | null, facts: ArchiveFacts): ArchiveDetail {
  const onSite = word(row?.onSiteOperation)
  const { applications, checkIns, budget, spent, tasks } = facts
  return {
    goal: word(event.purpose) ?? '행사 목표 미기재',
    audience: word(event.audience) ?? '참여 대상 미기재',
    scheduleAndPlace: joinParts([whenOf(event), whereOf(event)]),
    owner: joinParts([event.hostDepartment, event.hostMember]) || '담당 미정',
    scale:
      joinParts([
        capacityNote(event),
        facts.staff > 0 ? `운영 인력 ${facts.staff}명` : null,
        checkIns > 0 ? `참석 ${checkIns}명` : null,
      ]) || '규모 기록 없음',
    // 비율은 신청이 있을 때만 셀 수 있다. 소수 첫째 자리까지 — 그림이 그렇게 적었다(88.6%).
    attendance:
      applications === 0 && checkIns === 0
        ? '신청·참석 기록 없음'
        : applications === 0
          ? `신청 0명 → 참석 ${checkIns}명`
          : `신청 ${applications}명 → 참석 ${checkIns}명 (${((checkIns / applications) * 100).toFixed(1)}%)`,
    // 만족도를 담는 표가 없다. 지어내지 않고 그 사실을 말한다.
    satisfaction: '만족도 조사 기록 없음',
    budget:
      budget > 0
        ? `계획 ${won(budget)} → 집행 ${won(spent)} (${percent(spent, budget)}%)`
        : spent > 0
          ? `집행 ${won(spent)} (예산 계획 없음)`
          : '예산 기록 없음',
    taskCompletion:
      tasks.total === 0
        ? '업무 기록 없음'
        : joinParts([
            `전체 ${tasks.total}건`,
            `완료 ${tasks.done}건`,
            tasks.overdue > 0 ? `지연 ${tasks.overdue}건` : null,
          ]),
    // 현장 운영은 사람이 한 칸에 쓴다. 넷으로 가르는 구조가 글에 없다.
    runOrder: onSite ?? '현장 운영 기록 없음',
    staffing: onSite === null ? '기록 없음' : IN_ON_SITE,
    incident: onSite === null ? '기록 없음' : IN_ON_SITE,
    operationChange: onSite === null ? '기록 없음' : IN_ON_SITE,
  }
}

/**
 * 타임라인의 마디. **표가 아는 날짜에서만 난다** — 행사가 만들어진 때, 모집이 열리고
 * 닫힌 때, 회의가 열린 때, 행사의 일시, 결제와 정산을 끝낸 때. 완료 처리된 때는 표에
 * 열이 없어 마디가 없다(REC-01이 같은 까닭으로 '완료 처리일 미정'이라 말한다).
 */
function nodesOf(event: ArchiveEvent, facts: ArchiveFacts): Node[] {
  const nodes: Node[] = [
    { id: 'created', at: event.createdAt, title: '행사 생성', description: event.title },
  ]
  if (facts.survey?.opensAt) {
    nodes.push({
      id: 'survey-open',
      at: facts.survey.opensAt,
      title: '모집 시작',
      description: '참여 설문 접수 시작',
    })
  }
  if (facts.survey?.closesAt) {
    nodes.push({
      id: 'survey-close',
      at: facts.survey.closesAt,
      title: '모집 마감',
      description: `신청 ${facts.applications}명`,
    })
  }
  for (const meeting of facts.meetings) {
    if (meeting.at === null) continue
    nodes.push({
      id: `meeting:${meeting.id}`,
      at: meeting.at,
      title: '회의',
      description: joinParts([
        meeting.title,
        meeting.decisions > 0 ? `결정 ${meeting.decisions}건` : null,
      ]),
    })
  }
  if (event.startAt !== null) {
    nodes.push({
      id: 'event-start',
      at: event.startAt,
      title: '행사 진행',
      description:
        joinParts([event.place, facts.checkIns > 0 ? `참석 ${facts.checkIns}명` : null]) ||
        '참석 기록 없음',
    })
    if (event.endAt !== null && day(event.endAt) !== day(event.startAt)) {
      nodes.push({ id: 'event-end', at: event.endAt, title: '행사 종료', description: event.title })
    }
  }
  for (const payment of facts.payments) {
    if (payment.paidOn === null) continue
    nodes.push({
      id: `payment:${payment.id}`,
      at: payment.paidOn,
      title: '결제',
      description: `${payment.vendor} · ${won(payment.amount)}`,
    })
  }
  for (const settled of facts.purchase.settled) {
    nodes.push({
      id: `settled:${settled.id}`,
      at: settled.at,
      title: '정산 완료',
      description: settled.title,
    })
  }
  // 때의 차례로. 같은 때면 위에서 더한 차례 그대로다(정렬이 안정적이다).
  return nodes.sort((left, right) => left.at.getTime() - right.at.getTime())
}

function evidenceOf(facts: ArchiveFacts): EvidenceRow[] {
  const { tasks, meetings, documents, purchase, spent } = facts
  const decisions = meetings.reduce((sum, meeting) => sum + meeting.decisions, 0)
  const rows: Array<{ id: (typeof EVIDENCE_KINDS)[number]['id']; detail: string; linked: boolean }> = [
    {
      id: 'tasks',
      detail:
        tasks.total === 0
          ? '0건'
          : `${tasks.total}건 (${joinParts([`완료 ${tasks.done}`, tasks.overdue > 0 ? `지연 ${tasks.overdue}` : null])})`,
      linked: tasks.total > 0,
    },
    {
      id: 'meetings',
      detail: joinParts([`${meetings.length}건`, meetings.length > 0 ? `결정 ${decisions}건` : null]),
      linked: meetings.length > 0,
    },
    {
      id: 'documents',
      detail:
        documents.categories.length > 0
          ? `${documents.total}건 (${documents.categories.join('·')})`
          : `${documents.total}건`,
      linked: documents.total > 0,
    },
    {
      id: 'finance',
      detail: joinParts([`구매 요청 ${purchase.requests}건`, spent > 0 ? `집행 ${won(spent)}` : null]),
      linked: purchase.requests > 0 || spent > 0,
    },
  ]
  return rows.map((row) => {
    const kind = EVIDENCE_KINDS.find((one) => one.id === row.id)!
    const drawn: EvidenceRow = { id: kind.id, title: kind.title, detail: row.detail }
    // 갈 곳은 이어진 것이 있을 때만 — 열어도 볼 것이 없는 원본으로 보내지 않는다.
    if (row.linked) {
      drawn.actionLabel = OPEN_SOURCE
      drawn.targetKind = kind.id
    }
    return drawn
  })
}

function autoFilledOf(event: ArchiveEvent, facts: ArchiveFacts, nodes: Node[]): AutoFilled {
  const attended = attendanceMark(facts)
  const first = nodes[0]!
  const last = nodes[nodes.length - 1]!
  const counts: Record<(typeof EVIDENCE_KINDS)[number]['id'], number> = {
    tasks: facts.tasks.total,
    meetings: facts.meetings.length,
    documents: facts.documents.total,
    finance: facts.purchase.requests,
  }
  const linked = EVIDENCE_KINDS.filter((kind) => counts[kind.id] > 0)
  const unlinked = EVIDENCE_KINDS.filter((kind) => counts[kind.id] === 0)
  return {
    overview: joinParts([
      event.title,
      event.startAt === null ? '일시 미정' : day(event.startAt),
      event.hostDepartment === null ? null : `담당 ${event.hostDepartment}`,
      event.hostMember === null ? null : `책임자 ${event.hostMember}`,
      attended,
    ]),
    // 완료된 행사 목록의 눈에 띄는 딱지와 같은 셈이다 — 바탕이 없으면 그 조각이 없다.
    outcome:
      joinParts([
        attended,
        facts.budget > 0 ? `예산 집행 ${percent(facts.spent, facts.budget)}%` : null,
        facts.tasks.done > 0 ? `완료 업무 ${facts.tasks.done}건` : null,
      ]) || '참석·예산·업무 기록 없음',
    timeline:
      nodes.length === 1
        ? `${first.title} ${day(first.at)}`
        : joinParts([
            `${first.title} ${day(first.at)} → ${last.title} ${day(last.at)}`,
            nodes.length > 2 ? `마디 ${nodes.length}개` : null,
          ]),
    // 이어진 데이터가 없으면 그 사실까지 적는다 — 그림이 그렇게 적었다.
    evidence: joinParts([
      ...linked.map((kind) => `${kind.short} ${counts[kind.id]}건`),
      unlinked.length === 0 ? null : `${unlinked.map((kind) => kind.short).join('·')} 연결 데이터 없음`,
    ]),
  }
}
