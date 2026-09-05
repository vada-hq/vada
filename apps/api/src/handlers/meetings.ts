import type { Context } from 'hono'
import { canDo, orgOf, type Deps, type Handlers } from '../deps.ts'
import { createMeeting, saveMeetingDraft } from '../meetings/create.ts'
import {
  endConfirm,
  meetingAgendaList,
  meetingDetail,
  meetingPeople,
  startConfirm,
  type MeetingPowers,
} from '../meetings/detail.ts'
import { meetingFollowUps, myMeetingFollowUps } from '../meetings/follow-ups.ts'
import {
  meetingHostGrantConfirm,
  meetingHostOwner,
  meetingPermissionNotice,
} from '../meetings/host-role.ts'
import { cancelMeeting, grantHostRole, revokeHostRole } from '../meetings/manage.ts'
import {
  linkableEventOptions,
  meetingAttention,
  meetingDraft,
  meetingGroups,
  memberCandidates,
  type MeetingViewer,
} from '../meetings/meetings.ts'
import {
  agendaPickerOptions,
  meetingMinutes,
  meetingMinutesStatus,
  minutesProgress,
} from '../meetings/minutes.ts'
import {
  acknowledgeSummary,
  completeMinutes,
  generateSummary,
  saveMinutes,
} from '../meetings/minutes-write.ts'
import {
  completeCurrentAgenda,
  endMeeting,
  startMeeting,
  startNextAgenda,
} from '../meetings/run.ts'
import { NotFound } from '../routes.ts'

// 회의(OPS-MEET-*).
//
// 표는 `meetings`·`meeting_agendas`·`meeting_participants` 셋이다.
//
// **남은 것은 둘이다** — `meeting.modes`·`meeting.agendaDurations`. 고를 수 있는 값의
// 목록을 디자인이 그리지 않아 사람이 정할 자리다(docs/adding-a-flow.md의 '멈추는 자리').
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

/** 어느 회의의 것인가. 계약이 주소에 박아 둔 인자다. */
function meetingIdOf(c: Context): string {
  const meetingId = c.req.param('meetingId')
  if (meetingId === undefined || meetingId === '') {
    throw new NotFound('그 회의를 찾지 못했습니다')
  }
  c.set('auditSubject', { type: 'meeting', id: meetingId })
  return meetingId
}

/** 누구의 진행 권한인가. 주는 쪽도 빼는 쪽도 자리에 사람이 박혀 있다(계약이 맞췄다). */
function memberParamOf(c: Context): string {
  const memberId = c.req.param('memberId')
  if (memberId === undefined || memberId === '') {
    throw new NotFound('그 참가자를 찾지 못했습니다')
  }
  return memberId
}

/** 화면이 보낸 몸통. 못 읽으면 빈 것이다 — 무엇이 비었는지는 받는 쪽이 말한다. */
async function bodyOf(c: Context): Promise<Record<string, unknown>> {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>
}

/**
 * 이 사람이 이 회의에서 무엇을 할 수 있는가.
 *
 * **막는 검사를 그대로 부른다.** 화면에 내려보내는 판정과 요청을 막는 판정이 같은
 * 함수에서 나와야 갈리지 않는다 — 갈리는 쪽은 늘 화면이다.
 */
async function powersOf(c: Context, d: Deps, meetingId: string): Promise<MeetingPowers> {
  return {
    canRun: await canDo(c, d, 'meeting.run', meetingId),
    canOwn: await canDo(c, d, 'meeting.own', meetingId),
    // **회의록은 그 회의의 참가자가 정리한다**(사람이 정함 2026-09-05). 회의록 넷을
    // 막는 자리(meeting.minutes)와 같은 판정이다.
    canEditMinutes: await canDo(c, d, 'meeting.minutes', meetingId),
  }
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

  // ── 회의 상세 (OPS-MEET-03A~03C · 05A · 05B) ──────────────────────────
  //
  // **셋이 한 회의를 본다.** 상세·안건·참가자가 저마다 다른 자리지만 무엇을 그릴지는
  // 회의의 단계와 보는 사람이 함께 정한다 — 그래서 셋 다 보낸 사람을 함께 넘긴다.
  'meeting.detail': async (c, d) => {
    const orgId = orgOf(c)
    const meetingId = meetingIdOf(c)
    return meetingDetail(
      d.db,
      orgId,
      memberOf(c),
      meetingId,
      await powersOf(c, d, meetingId),
      d.invite.now(),
    )
  },
  'meeting.agendas': async (c, d) => meetingAgendaList(d.db, orgOf(c), meetingIdOf(c)),
  // 줄 단추는 **진행 권한을 바꿀 수 있는 사람에게만** 온다. 04B가 그 화면이고,
  // 판정은 그 동작을 막는 자리(meeting.own)와 같은 곳에서 나온다.
  'meeting.participants': async (c, d) => {
    const orgId = orgOf(c)
    const meetingId = meetingIdOf(c)
    return meetingPeople(
      d.db,
      orgId,
      meetingId,
      {
        query: c.req.query('query'),
        excludeHostOwner: c.req.query('excludeHostOwner') === 'true',
      },
      { canManageHostRole: await canDo(c, d, 'meeting.own', meetingId) },
    )
  },

  // ── 진행 권한 (OPS-MEET-04B · D03) ────────────────────────────────────
  //
  // **만든 사람은 목록의 한 줄이 아니라 제 자리를 갖는다.** 04B가 맨 위 칸에 따로
  // 그리고 목록에서는 뺀다 — 같은 사람을 03A와 다른 말로 적는 자리이기도 하다.
  'meeting.hostOwner': async (c, d) => meetingHostOwner(d.db, orgOf(c), meetingIdOf(c)),
  // 안내 글은 **서버가 든다.** 명세가 들면 권한이 하나 늘 때마다 명세가 틀린다.
  'meeting.permissionNotice': async (c, d) =>
    meetingPermissionNotice(d.db, orgOf(c), meetingIdOf(c)),
  'meeting.hostGrantConfirm': async (c, d) =>
    meetingHostGrantConfirm(d.db, orgOf(c), meetingIdOf(c), c.req.query('memberId') ?? ''),
  // **만든 사람만 준다·뺀다**(meeting.own). 주는 것은 더하는 것이고 빼는 것은 만든
  // 사람에게는 안 된다 — 그 규칙은 `manage.ts`가 든다.
  'meeting.grantHostRole': async (c, d) =>
    grantHostRole(d.db, orgOf(c), meetingIdOf(c), memberParamOf(c)),
  'meeting.revokeHostRole': async (c, d) =>
    revokeHostRole(d.db, orgOf(c), meetingIdOf(c), memberParamOf(c)),

  // ── 회의 취소 (OPS-MEET-D04) ──────────────────────────────────────────
  //
  // **지우는 것이 아니다.** 취소된 기록으로 남고, 누가 취소했는지는 서버가 안다.
  'meeting.cancel': async (c, d) =>
    cancelMeeting(d.db, orgOf(c), meetingIdOf(c), memberOf(c), await bodyOf(c), d.invite.now()),

  // ── 회의록 (OPS-MEET-06A · 06B · 07) ──────────────────────────────────
  //
  // **안건마다의 기록과 다른 물건이다.** 안건의 논의·결정은 `meeting.agendas`가 갖고
  // 여기 있는 것은 회의 전체를 한 덩이로 줄인 글과 그 정리 현황이다.
  'meeting.minutes': async (c, d) => meetingMinutes(d.db, orgOf(c), meetingIdOf(c)),
  'meeting.minutesStatus': async (c, d) => meetingMinutesStatus(d.db, orgOf(c), meetingIdOf(c)),
  // **마칠 수 있는가는 조건 목록과 한 셈이다.** 딱지의 수·목록·막는 말이 여기서 나오고
  // 마치는 자리도 이 답으로 막는다.
  'meeting.minutesProgress': async (c, d) => minutesProgress(d.db, orgOf(c), meetingIdOf(c)),
  'meeting.agendaPicker.options': async (c, d) =>
    agendaPickerOptions(d.db, orgOf(c), meetingIdOf(c)),

  // ── 회의록을 쓴다 (OPS-MEET-06B · 08) ─────────────────────────────────
  //
  // **넷 다 그 회의의 참가자가 한다**(meeting.minutes). 요약 초안은 기록에서만 나오고,
  // 마치는 것은 조건이 다 찼을 때만이며, 확인은 회의가 아니라 그 사람의 상태다.
  'meeting.saveMinutes': async (c, d) =>
    saveMinutes(d.db, orgOf(c), meetingIdOf(c), await bodyOf(c), d.invite.now()),
  'meeting.generateSummary': async (c, d) =>
    generateSummary(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.completeMinutes': async (c, d) =>
    completeMinutes(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.acknowledgeSummary': async (c, d) =>
    acknowledgeSummary(d.db, orgOf(c), meetingIdOf(c), memberOf(c), d.invite.now()),

  // ── 후속 업무 (OPS-MEET-05A · 06B · 07 · 08) ──────────────────────────
  //
  // **둘은 다른 물음이다.** 위는 '이 회의가 만든 후속 업무'이고 아래는 '그중 내
  // 것'이다 — 비었을 때 07과 08이 다르게 말하므로 자리도 둘이다.
  'meeting.followUps': async (c, d) => meetingFollowUps(d.db, orgOf(c), meetingIdOf(c)),
  'meeting.myFollowUps': async (c, d) =>
    myMeetingFollowUps(d.db, orgOf(c), meetingIdOf(c), memberOf(c)),

  // ── 시작·종료 확인 (OPS-MEET-D01 · D02) ───────────────────────────────
  'meeting.startConfirm': async (c, d) =>
    startConfirm(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.endConfirm': async (c, d) => endConfirm(d.db, orgOf(c), meetingIdOf(c)),

  // ── 회의를 진행한다 (OPS-MEET-D01 · D02 · 05B) ────────────────────────
  //
  // **넷 다 인자가 회의 하나뿐이다.** 어느 안건인지는 보내지 않는다 — '이 안건'은
  // 지금 진행 중인 것이고 그것은 서버가 안다.
  'meeting.start': async (c, d) =>
    startMeeting(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.end': async (c, d) => endMeeting(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.completeAgenda': async (c, d) =>
    completeCurrentAgenda(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
  'meeting.startNextAgenda': async (c, d) =>
    startNextAgenda(d.db, orgOf(c), meetingIdOf(c), d.invite.now()),
}
