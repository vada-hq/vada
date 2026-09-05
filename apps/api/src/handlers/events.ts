import { canDo, orgOf, type Handlers } from '../deps.ts'
import {
  attendanceQr,
  deactivateAttendanceQr,
  regenerateAttendanceQr,
} from '../events/attendance-qr.ts'
import { eventBasicsDraft, saveEventBasics } from '../events/basics.ts'
import { completeConfirm, endPermission } from '../events/ending.ts'
import {
  createEvent,
  eventBasics,
  eventList,
  eventSummary,
  eventWorkspace,
} from '../events/events.ts'
import { eventMeetingCounts, eventMeetings } from '../events/related-meetings.ts'
import { eventSchedule } from '../events/schedule.ts'
import {
  eventStaffDepartmentTree,
  eventStaffLeaders,
  staffLeaderCandidates,
  staffSetupPreview,
} from '../events/staff.ts'
import { eventSurvey, surveyReplaceImpact } from '../events/survey.ts'
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
