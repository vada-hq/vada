import { canDo, orgOf, type Handlers } from '../deps.ts'
import {
  attendanceQr,
  deactivateAttendanceQr,
  regenerateAttendanceQr,
} from '../events/attendance-qr.ts'
import { eventBasicsDraft, saveEventBasics } from '../events/basics.ts'
import {
  createEvent,
  eventBasics,
  eventList,
  eventSummary,
  eventWorkspace,
} from '../events/events.ts'
import { NotFound } from '../routes.ts'

// 행사 — 목록과 기본정보, 그리고 참석 확인 QR.

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
