import type { Context } from 'hono'
import { canDo, orgOf, type Handlers } from '../deps.ts'
import { createMeeting, saveMeetingDraft } from '../meetings/create.ts'
import {
  linkableEventOptions,
  meetingAttention,
  meetingDraft,
  meetingGroups,
  memberCandidates,
  type MeetingViewer,
} from '../meetings/meetings.ts'
import { NotFound } from '../routes.ts'

// 회의(OPS-MEET-*).
//
// 표는 `meetings`·`meeting_agendas`·`meeting_participants` 셋이다.
//
// **회의는 '누가 보느냐'가 값을 바꾼다.** 목록 위의 띠도 줄마다의 딱지도 보는 사람과
// 그 회의의 관계가 정한다 — 그래서 읽는 자리마다 보낸 사람을 함께 넘긴다.

/**
 * 이 요청을 보낸 구성원.
 *
 * `orgOf`가 학생회를 집는 것과 같은 자리에서 사람도 집는다 — 구성원이 아니면 여기까지
 * 오지 않으므로(권한 미들웨어가 앞서 막는다) 없을 때는 없다고 말한다.
 */
function memberOf(c: Context): MeetingViewer {
  const membership = c.get('sender')?.membership
  if (membership === null || membership === undefined) {
    throw new NotFound('학생회를 찾지 못했습니다')
  }
  return { memberId: membership.memberId }
}

export const meetingHandlers: Handlers = {
  // ── 회의 목록 (OPS-MEET-01A~01D) ───────────────────────────────────────
  'meeting.groups': async (c, d) => {
    const orgId = orgOf(c)
    c.set('auditSubject', { type: 'organization', id: orgId })
    return meetingGroups(d.db, orgId, memberOf(c), { query: c.req.query('query') })
  },
  // 만들 수 있는 사람에게만 머리에 그 단추가 그려진다. **판정은 막는 검사와 같은
  // 함수에서 나온다** — 두 곳에서 나오면 단추를 그렸는데 눌리면 막힌다.
  'meeting.attention': async (c, d) => {
    const orgId = orgOf(c)
    return meetingAttention(d.db, orgId, memberOf(c), {
      canCreateMeeting: await canDo(c, d, 'meeting.create'),
    })
  },

  // ── 회의 만들기·고치기 (OPS-MEET-02) ──────────────────────────────────
  //
  // **읽는 자리와 쓰는 자리의 권한이 다르다.** 초안은 구성원이면 열리고 만드는 것은
  // 회장단·부서장만 한다 — 계약이 자리마다 적어 두었고 미들웨어가 그대로 건다.
  'meeting.draft': async (c, d) => {
    const meetingId = c.req.query('meetingId')
    if (meetingId !== undefined && meetingId !== '') {
      c.set('auditSubject', { type: 'meeting', id: meetingId })
    }
    return meetingDraft(d.db, orgOf(c), memberOf(c), meetingId)
  },
  'meeting.memberCandidates': async (c, d) =>
    memberCandidates(d.db, orgOf(c), { query: c.req.query('query') }),
  'event.linkable.options': async (c, d) => linkableEventOptions(d.db, orgOf(c)),

  'meeting.create': async (c, d) => {
    const orgId = orgOf(c)
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const made = await createMeeting(d.db, orgId, memberOf(c), draft, {
      id: d.newId,
      now: d.invite.now,
    })
    c.set('auditSubject', { type: 'meeting', id: made.id })
    return made
  },
  // 제출과 **같은 것**을 보내되 보내는 곳이 다르다. 임시 저장한 회의는 다른
  // 참가자에게 보이지 않는다.
  'meeting.saveDraft': async (c, d) => {
    const orgId = orgOf(c)
    const draft = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const made = await saveMeetingDraft(d.db, orgId, memberOf(c), draft, {
      id: d.newId,
      now: d.invite.now,
    })
    c.set('auditSubject', { type: 'meeting', id: made.id })
    return made
  },
}
