import { orgOf, type Handlers } from '../deps.ts'
import {
  eventParticipants,
  participantAffiliations,
  participantApplyStatuses,
  participantAttendStatuses,
  participantPaging,
  participantPayStatuses,
} from '../participants/roster.ts'
import {
  surveyActivation,
  surveyActivationConditions,
  surveyQuestionList,
  surveySettingsDraft,
} from '../participants/survey-setup.ts'

// 행사 참여자와 참여 설문(EVT-04 · 04B · 05).
//
// **행사 영역과 가른다.** 행사 개요·마무리를 붙이는 사람이 `events.ts`를 든다.
// 여기 오는 것은 같은 행사의 것이지만 다른 표를 본다 — 신청(`survey_applications`)과
// 참석(`attendance_check_ins`), 그리고 설문의 문항이다.
//
// **어느 행사인지가 두 꼴로 온다.** 참가자 명단은 조회 인자로 받고(`?eventId=`)
// 설문 쪽은 주소에 박혀 온다(`/events/{eventId}/survey/...`) — 계약이 자리마다
// 그렇게 적었고 여기는 그대로 따른다.

export const participantHandlers: Handlers = {
  // ── 행사 참가자 명단 (EVT-04 · EVT-04B) ────────────────────────────────
  //
  // **거르는 것도 자르는 것도 서버가 한다.** 검색어·거르개 넷·쪽 번호가 전부 여기까지
  // 오고, 화면은 받아온 것을 다시 손대지 않는다.
  'event.participants': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return eventParticipants(d.db, orgOf(c), eventId, {
      query: c.req.query('query'),
      affiliation: c.req.query('affiliation'),
      applyStatus: c.req.query('applyStatus'),
      payStatus: c.req.query('payStatus'),
      attendStatus: c.req.query('attendStatus'),
      page: c.req.query('page'),
    })
  },
  // 쪽 번호만 빼고 목록과 같은 인자를 받는다 — 거르는 조건이 같아야 같은 수가 나온다.
  'event.participantPaging': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantPaging(d.db, orgOf(c), eventId, {
      query: c.req.query('query'),
      affiliation: c.req.query('affiliation'),
      applyStatus: c.req.query('applyStatus'),
      payStatus: c.req.query('payStatus'),
      attendStatus: c.req.query('attendStatus'),
    })
  },
  // **고르는 목록도 같은 서버에서 온다.** 표는 진짜인데 고를 것이 가짜면 사람은
  // 없는 소속을 고르고 빈 명단을 본다.
  'event.participantAffiliations.options': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantAffiliations(d.db, orgOf(c), eventId)
  },
  'event.participantApplyStatus.options': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantApplyStatuses(d.db, orgOf(c), eventId)
  },
  'event.participantPayStatus.options': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantPayStatuses(d.db, orgOf(c), eventId)
  },
  'event.participantAttendStatus.options': async (c, d) => {
    const eventId = c.req.query('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return participantAttendStatuses(d.db, orgOf(c), eventId)
  },

  // ── 참여 설문을 세우는 자리 (EVT-05) ───────────────────────────────────
  //
  // **막는 것은 서버다.** 화면은 무엇이 모자란지 세지 않고 서버가 준 까닭만 그린다.
  'event.surveySettingsDraft': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return surveySettingsDraft(d.db, orgOf(c), eventId)
  },
  'event.surveyActivation': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return surveyActivation(d.db, orgOf(c), eventId)
  },
  'event.surveyActivationConditions': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return surveyActivationConditions(d.db, orgOf(c), eventId)
  },
  'event.surveyQuestions': async (c, d) => {
    const eventId = c.req.param('eventId')!
    c.set('auditSubject', { type: 'event', id: eventId })
    return surveyQuestionList(d.db, orgOf(c), eventId)
  },
}
