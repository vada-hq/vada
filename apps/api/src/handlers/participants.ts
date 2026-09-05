import type { Handlers } from '../deps.ts'

// 행사 참여자와 참여 설문(EVT-04 · 04B · 05). **아직 비어 있다** — 자리를 미리 열어 둔 것이다.
//
// **행사 영역과 가른다.** 행사 개요·마무리를 나란히 붙이는 사람이 `events.ts`를 든다.
// 여기 오는 것은 같은 행사의 것이지만 다른 표를 본다 — 신청(`survey_applications`)과
// 참석(`attendance_check_ins`), 그리고 설문의 문항이다.

export const participantHandlers: Handlers = {}
