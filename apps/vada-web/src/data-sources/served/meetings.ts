import type { Served } from './area'

/**
 * 회의(OPS-MEET-01A · 02 · 03A~03C · 04B · 05A · 05B · 06A · 06B · 07 · 08 · 09 · D01~D04).
 *
 * **묶음을 서버가 짓는다.** 묶음 하나가 행사 하나이고 어디에도 안 걸린 회의는
 * '정기·상시 회의'로 온다 — 묶음 수가 데이터에 달려 있어 화면이 미리 알 수 없다.
 *
 * **보는 사람에 따라 통째로 달라지는 자리가 둘이다.** 목록 위의 띠와 줄마다의
 * 딱지는 '누가 보느냐'가 정하고 그것은 서버만 안다. 개발용 응답은 늘 '일반
 * 참가자'였고, 그래서 진행 권한자와 미참가자가 보는 화면은 아무도 못 봤다.
 *
 * **`meeting.detail` 하나를 화면 열한 장이 읽는다.** 명세가 단계마다 출처를 가르지
 * 않았고, 가르면 화면이 '지금 어느 단계인가'를 알아야 한다 — 그 단계에 없는 조각은
 * 오지 않는다.
 *
 * **회의록과 후속 업무와 진행 권한이 여기 올라오면서 06A·06B·07·08·04B·D03이
 * 열린다.** 회의록의 요약과 정리 현황은 `meetings` 표에서, 후속 업무는 `tasks`
 * 표에서 온다 — 회의가 만든 업무도 업무 표에 살고, 회의가 제 표에 따로 담지 않는다.
 *
 * **회의록 정리와 회의 관리가 올라오면서 06B가 통째로 열렸다.** 정리 완료 조건은
 * 그림이 그린 다섯 줄 그대로이고 딱지의 수와 한 셈에서 나온다 — 마치는 자리도 그
 * 답으로 막는다. 취소와 진행 권한 부여·해제는 만든 사람만 한다.
 *
 * 아직 안 올린 것 둘: `meeting.modes`·`meeting.agendaDurations`는 **고를 수 있는
 * 값의 목록이 명세에 없다**(디자인이 그 목록을 그리지 않았다 — 사람이 정할 자리다).
 * `meeting.documents`는 `documents` 표를 맡은 자리가 따로 붙인다.
 */
export const meetings: Served = {
  reads: [
    'meeting.groups',
    'meeting.attention',
    'meeting.draft',
    'meeting.memberCandidates',
    // 회의를 걸 수 있는 행사. 고르는 목록이라 다른 카탈로그에 산다.
    'event.linkable',
    // 상세 셋. 무엇을 그릴지는 회의의 단계와 보는 사람이 함께 정한다.
    'meeting.detail',
    'meeting.agendas',
    'meeting.participants',
    // 시작·종료 전에 살펴 준 것. 며칠 이른지도 무엇이 남았는지도 서버만 안다.
    'meeting.startConfirm',
    'meeting.endConfirm',
    // 진행 권한(04B · D03). 안내 글도 확인 글도 서버가 든다 — 명세가 들면 권한이
    // 하나 늘 때마다 명세가 틀린다.
    'meeting.hostOwner',
    'meeting.permissionNotice',
    'meeting.hostGrantConfirm',
    // 회의록(06A · 06B · 07). 요약은 없을 수 있고 그때도 **없다는 말이** 온다.
    'meeting.minutes',
    'meeting.minutesStatus',
    // 정리를 마칠 수 있는가(06B). 조건 줄·딱지의 수·막는 말이 한 셈에서 온다.
    'meeting.minutesProgress',
    // 정리할 안건을 고르는 목록(06B). '확인 필요'도 처음 열릴 것도 서버가 표시한다.
    'meeting.agendaPicker',
    // 후속 업무(05A · 06B · 07 · 08). **둘은 다른 물음이다** — 비었을 때 07과 08이
    // 다르게 말하므로 자리도 둘이다.
    'meeting.followUps',
    'meeting.myFollowUps',
  ],
  writes: [
    // 둘이 **같은 것**을 보낸다. 다른 것은 보내는 곳과 그 결과의 단계뿐이다.
    'meeting.create',
    'meeting.saveDraft',
    // 넷 다 인자가 회의 하나뿐이다 — 어느 안건인지는 서버가 안다.
    'meeting.start',
    'meeting.end',
    'meeting.completeAgenda',
    'meeting.startNextAgenda',
    // 회의록(06B · 08). 참가자가 쓴다 — 결정을 저장하고, 기록에서 요약 초안을 만들고,
    // 조건이 다 찼을 때 마치고, 마친 요약을 확인한다.
    'meeting.saveMinutes',
    'meeting.generateSummary',
    'meeting.completeMinutes',
    'meeting.acknowledgeSummary',
    // 회의 관리(D04 · D03 · 04B). 만든 사람만 한다.
    'meeting.cancel',
    'meeting.grantHostRole',
    'meeting.revokeHostRole',
  ],
}
