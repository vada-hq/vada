import { canDo, orgOf, type Handlers } from '../deps.ts'
import {
  attendanceQr,
  deactivateAttendanceQr,
  regenerateAttendanceQr,
} from '../events/attendance-qr.ts'
import { eventBasicsDraft, saveEventBasics } from '../events/basics.ts'
import { completeConfirm, endPermission } from '../events/ending.ts'
import { eventFinanceAlerts, eventFinanceBoard, eventFinanceSummary } from '../events/finance.ts'
import {
  createEvent,
  eventBasics,
  eventList,
  eventSummary,
  eventWorkspace,
} from '../events/events.ts'
import {
  checklist,
  overviewBriefing,
  overviewHighlights,
  participantStats,
  recentChanges,
  recruitSettings,
} from '../events/overview.ts'
import { eventMeetingCounts, eventMeetings } from '../events/related-meetings.ts'
import { eventSchedule } from '../events/schedule.ts'
import {
  eventStaffDepartmentTree,
  eventStaffLeaders,
  saveEventStaff,
  setupEventStaff,
  staffDeptLeaderCandidates,
  staffLeaderCandidates,
  staffMemberCandidates,
  staffSetupPreview,
  staffUnassignedMembers,
} from '../events/staff.ts'
import { eventSurvey, replaceSurvey, surveyReplaceImpact } from '../events/survey.ts'
import { wrapUpBanner, wrapUpCounts, wrapUpRemaining } from '../events/wrap-up.ts'
import { newToken } from '../public/tokens.ts'
import { NotFound } from '../routes.ts'

// 행사 — 목록과 기본정보, 참석 확인 QR, 그리고 행사 공간의 갈피들.

export const eventHandlers: Handlers = {
  // ── 행사 (EVT-00A · EVT-00B · EVT-02) ──────────────────────────────────
  'event.list': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return eventList(
      d.db,
      orgId,
      { query: c.req.query('query'), status: c.req.query('status') },
      d.invite,
    )
  },
  // 만들 수 있는 사람에게만 머리에 그 단추가 그려진다. **역할 이름이 아니라
  // 할 수 있는 일로 가른다** — 판정은 정책 하나에서 나온다.
  'event.listViewer': async (c, d) =>
    canDo(c, d, 'event.create').then((canCreateEvent) => ({ canCreateEvent })),
  'event.summary': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventSummary(d.db, orgOf(c), eventId, d.invite)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },
  'event.workspace': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventWorkspace(d.db, orgOf(c), eventId, {
      canManage: await canDo(c, d, 'event.manage', eventId),
    })
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },
  'event.basics': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventBasics(d.db, orgOf(c), eventId)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },

  // ── 행사 개요 (EVT-02) ─────────────────────────────────────────────────
  //
  // **여섯 자리가 한 화면을 세운다.** 전부 세어서 만든 말이고 표에 그런 열은 없다 —
  // '모집 마감까지 3일'은 설문의 마감 시각과 지금이 만드는 문장이다.
  //
  // 목록 둘(확인 항목·최근 변경)에는 **계약이 404를 두지 않았다.** 남의 학생회
  // 행사를 물으면 거르고 남은 것이 없다고 답한다.
  'event.overviewBriefing': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return overviewBriefing(d.db, orgOf(c), eventId, d.invite)
  },
  'event.overviewHighlights': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return overviewHighlights(d.db, orgOf(c), eventId, d.invite)
  },
  'event.participantStats': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantStats(d.db, orgOf(c), eventId)
  },
  'event.recruitSettings': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return recruitSettings(d.db, orgOf(c), eventId)
  },
  'event.checklist': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return checklist(d.db, orgOf(c), eventId, d.invite)
  },
  'event.recentChanges': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return recentChanges(d.db, orgOf(c), eventId, d.invite)
  },

  // ── 행사 개요 — 후속 정리 중 (EVT-02D) ─────────────────────────────────
  //
  // **어느 행사인지가 주소로 온다** — 개요의 여섯과 갈리는 자리다.
  'event.wrapUpBanner': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return wrapUpBanner(d.db, orgOf(c), eventId)
  },
  'event.wrapUpCounts': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return wrapUpCounts(d.db, orgOf(c), eventId)
  },
  'event.wrapUpRemaining': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return wrapUpRemaining(d.db, orgOf(c), eventId, d.invite)
  },

  // ── 기본정보 고치기 (EVT-02B) ──────────────────────────────────────────
  //
  // **읽는 자리와 고치는 자리의 권한이 다르다.** 초안은 구성원이면 열리고 저장은
  // 그 행사를 맡은 사람만 한다 — 계약이 자리마다 적어 두었고 미들웨어가 그대로 건다.
  'event.basicsDraft': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventBasicsDraft(d.db, orgOf(c), eventId)
  },
  'event.saveBasics': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return saveEventBasics(d.db, orgOf(c), eventId, draft, d.invite)
  },

  // ── 행사를 끝내는 두 모달 (EVT-02C · EVT-02E) ──────────────────────────
  //
  // **여기서 판정하지 않는다.** 두 자리 모두 구성원이면 열리고(계약이 그렇게 적었다),
  // 무엇을 하는 자리가 아니라 **누가 할 수 있는지를 말해 주는** 자리다. 막는 일은
  // 실제로 종료·완료하는 변이가 한다.
  'event.endPermission': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return endPermission(d.db, orgOf(c), eventId)
  },
  'event.completeConfirm': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return completeConfirm(d.db, orgOf(c), eventId)
  },

  // ── 행사 운영 조직 (EVT-01 · EVT-03A) ──────────────────────────────────
  //
  // **학생회의 기본 조직과 다른 물건이다.** 미리보기만 반대로 기본 조직을 본다 —
  // 아직 만들어지지 않은 것을 미리 보는 자리이기 때문이다.
  'event.staffLeaders': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventStaffLeaders(d.db, orgOf(c), eventId)
  },
  'event.staffDepartments': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventStaffDepartmentTree(d.db, orgOf(c), eventId)
  },
  'event.staffSetupPreview': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return staffSetupPreview(d.db, orgOf(c), eventId, c.req.query('setupMode'))
  },
  'event.staffLeaderCandidates.options': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return staffLeaderCandidates(d.db, orgOf(c), eventId)
  },

  // ── 행사 운영 조직 — 수정 (EVT-03B) ────────────────────────────────────
  //
  // 오른쪽 기둥은 **이 학생회 구성원 중 이 행사 조직에 자리가 없는 사람**이고, 부서
  // 카드의 두 고르는 칸은 어느 부서인지를 주소에 함께 싣고 온다.
  'event.staffUnassignedMembers': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return staffUnassignedMembers(d.db, orgOf(c), eventId)
  },
  'event.staffDeptLeaderCandidates.options': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return staffDeptLeaderCandidates(d.db, orgOf(c), eventId, c.req.param('departmentId')!)
  },
  'event.staffMemberCandidates.options': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return staffMemberCandidates(d.db, orgOf(c), eventId, c.req.param('departmentId')!)
  },
  // **세우는 것과 고치는 것은 다른 자리다.** 세우기는 처음 한 번(conflict)이고 고치기는
  // 조직 전부를 덮어쓴다(overwrite). 둘 다 event.staff 영역이라 회장단이 아니면 그 행사
  // 조직의 관리자여야 한다 — 미들웨어가 계약을 읽어 건다.
  'event.staff.setup': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null
    return setupEventStaff(d.db, orgOf(c), eventId, draft ?? {}, { newId: d.newId })
  },
  'event.staff.save': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null
    return saveEventStaff(d.db, orgOf(c), eventId, draft ?? {}, { newId: d.newId })
  },

  // ── 참여 설문 (EVT-05 · EVT-05B) ───────────────────────────────────────
  'event.survey': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventSurvey(d.db, orgOf(c), eventId)
  },
  'event.surveyReplaceImpact': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return surveyReplaceImpact(d.db, orgOf(c), eventId)
  },
  // **여파에 적힌 대로 일어난다.** 새 링크의 열쇠는 밖에서 받는다 — 추측할 수 없어야
  // 하고, 밖에서 열리는 모양(22자)이어야 한다(`public/tokens.ts`가 그것을 만든다).
  'event.survey.replace': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown> | null
    return replaceSurvey(d.db, orgOf(c), eventId, draft ?? {}, { newId: d.newId, newToken })
  },

  // ── 행사에 걸린 회의와 일정 (EVT-MEET-01 · EVT-SCHED-01) ───────────────
  //
  // **어느 행사인지가 인자로 온다** — 이 둘만 주소가 아니라 조회 인자로 받는다.
  'event.meetingCounts': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventMeetingCounts(d.db, orgOf(c), eventId)
  },
  'event.meetings': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventMeetings(d.db, orgOf(c), eventId)
  },
  'event.schedule': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventSchedule(d.db, orgOf(c), eventId, c.req.query('filter'), d.invite)
  },

  // ── 행사 재정 — 개요 (EVT-FIN-01) ──────────────────────────────────────
  //
  // **재정 화면들과 같은 표를 같은 셈으로 본다**(`events/finance.ts`). 어느 행사인지가
  // 조회 인자로 온다. 요약과 건수에는 404가 있고 보드에는 없다 — 남의 학생회 행사의
  // 보드를 물으면 거르고 남은 것이 없다고 답한다(행사 업무 보드와 같다).
  'event.financeSummary': async (c, d) => {
    const eventId = c.req.query('eventId') ?? ''
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventFinanceSummary(d.db, orgOf(c), eventId)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },
  'event.financeAlerts': async (c, d) => {
    const eventId = c.req.query('eventId') ?? ''
    c.set('auditSubject', { type: 'event', id: eventId })
    const row = await eventFinanceAlerts(d.db, orgOf(c), eventId)
    if (row === null) throw new NotFound('그 행사를 찾지 못했습니다')
    return row
  },
  'event.financeBoard': async (c, d) => {
    const eventId = c.req.query('eventId') ?? ''
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventFinanceBoard(d.db, orgOf(c), eventId, c.req.query('stage'))
  },

  // ── 참석 확인 QR (EVT-04B) ─────────────────────────────────────────────
  //
  // 밖에서 오는 사람 쪽은 이미 지었다. 여기는 그 QR을 **만들고 죽이는** 쪽이다.
  'event.attendanceQr': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return attendanceQr(d.db, orgOf(c), eventId, d.invite)
  },
  // **되돌릴 수 없다.** 뿌린 포스터의 QR이 전부 죽는다.
  'event.attendanceQr.regenerate': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return regenerateAttendanceQr(d.db, orgOf(c), eventId, {
      newId: d.newId,
      now: d.invite.now,
    })
  },
  'event.attendanceQr.deactivate': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return deactivateAttendanceQr(d.db, orgOf(c), eventId)
  },
  'event.create': async (c, d) => {
    const orgId = orgOf(c)
    const draft = (await c.req.json().catch(() => ({}))) as { title?: unknown }
    const made = await createEvent(d.db, orgId, draft, { id: d.newId, now: d.invite.now })
    c.set('auditSubject', { type: 'event', id: made.id })
    return made
  },
}
