import type { Served } from './area'

/**
 * 회의의 앞자락(OPS-MEET-01A · OPS-MEET-02).
 *
 * **묶음을 서버가 짓는다.** 묶음 하나가 행사 하나이고 어디에도 안 걸린 회의는
 * '정기·상시 회의'로 온다 — 묶음 수가 데이터에 달려 있어 화면이 미리 알 수 없다.
 *
 * **보는 사람에 따라 통째로 달라지는 자리가 둘이다.** 목록 위의 띠와 줄마다의
 * 딱지는 '누가 보느냐'가 정하고 그것은 서버만 안다. 개발용 응답은 늘 '일반
 * 참가자'였고, 그래서 진행 권한자와 미참가자가 보는 화면은 아무도 못 봤다.
 *
 * 아직 안 올린 것 둘: `meeting.modes`와 `meeting.agendaDurations`. **고를 수 있는
 * 값의 목록이 명세에 없다** — 디자인이 그 목록을 그리지 않았고, 서버가 지어내면
 * 그것은 목록을 만드는 일이지 붙이는 일이 아니다.
 */
export const meetings: Served = {
  reads: [
    'meeting.groups',
    'meeting.attention',
    'meeting.draft',
    'meeting.memberCandidates',
    // 회의를 걸 수 있는 행사. 고르는 목록이라 다른 카탈로그에 산다.
    'event.linkable',
  ],
  // 둘이 **같은 것**을 보낸다. 다른 것은 보내는 곳과 그 결과의 단계뿐이다.
  writes: ['meeting.create', 'meeting.saveDraft'],
}
