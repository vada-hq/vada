import type { Served } from './area'

/**
 * 행사 참여자와 참여 설문(EVT-04 · 04B · 05).
 *
 * 행사 개요와 가른다. 같은 행사의 것이지만 보는 표가 다르다 — 신청과 참석, 설문의 문항.
 *
 * **EVT-04B는 자기 자리를 하나도 안 갖는다.** 참석 확인 QR 모달은 `event.attendanceQr`
 * 하나만 읽는데(행사 영역이 이미 답한다), 그 뒤에 EVT-04가 그대로 남으므로 이 목록이
 * 차야 그 모달도 열린다 — 겹쳐 뜨는 화면은 뒤 화면의 자리까지 함께 읽는다.
 */
export const participants: Served = {
  reads: [
    // 행사 참가자 명단(EVT-04). 거르는 일도 세는 일도 서버가 한다 — 화면은 받아온
    // 것을 다시 거르지도 자르지도 않는다.
    'event.participants',
    'event.participantPaging',
    // 고르는 목록도 같은 서버에서 온다. 표는 진짜인데 고를 것이 가짜면 사람은 없는
    // 소속을 고르고 빈 명단을 본다.
    'event.participantAffiliations',
    'event.participantApplyStatus',
    'event.participantPayStatus',
    'event.participantAttendStatus',
    // 참여 설문을 세우는 자리(EVT-05). **막는 것은 서버다** — 무엇이 모자란지는
    // 서버가 세고 화면은 그 까닭만 그린다.
    'event.surveySettingsDraft',
    'event.surveyActivation',
    'event.surveyActivationConditions',
    'event.surveyQuestions',
  ],
  // 아직 없다. 설문을 켜는 것(`event.survey.activate`)도 문항을 고치는 것도 이 회차의
  // 것이 아니다 — 읽는 자리를 먼저 세운다.
  writes: [],
}
