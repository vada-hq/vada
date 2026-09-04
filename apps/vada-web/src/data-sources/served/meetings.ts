import type { Served } from './area'

/**
 * 회의(OPS-MEET-01A · 02 · 03A~03C · 05A · 05B · D01 · D02).
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
 * 오지 않는다. 여기 올린 뒤부터 06·07·08·09도 이 서버의 답을 받는다: 그 화면들이
 * 그리는 조각 중 아직 안 오는 것이 있고(회의록 요약·후속 업무·대체 회의) 그 자리는
 * 다음 회차의 몫이다.
 *
 * 아직 안 올린 것 셋: `meeting.modes`·`meeting.agendaDurations`는 **고를 수 있는
 * 값의 목록이 명세에 없고**(디자인이 그 목록을 그리지 않았다), `meeting.documents`는
 * `documents` 표를 맡은 자리가 따로 붙인다.
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
  ],
}
