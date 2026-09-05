import type { Served } from './area'

/**
 * 운영 공간 그 자체(OPS-00 · OPS-CAL-01).
 *
 * **회의와 가른다.** 회의는 `meetings.ts`가 든다. 여기 오는 것은 업무·회의·행사·마감을
 * 가로질러 세는 것이다 — 어느 한 영역에 두면 그 영역이 남의 표를 읽게 된다.
 *
 * **달력은 원본이 아니라 비친 것이다.** 표가 없고, 그려지는 것은 행사의 일시·회의의
 * 일시·업무의 기한이다 — 서버가 그 셋을 모아 한 격자에 세운다.
 */
export const ops: Served = {
  reads: [
    // 보는 사람의 이름이 들어가는 문장이라 서버가 완성해서 준다.
    'ops.intro',
    // 공간 넷은 제품이 정한 고정 구조라 명세가 갖고, 건수만 서버가 준다.
    'ops.spaceStats',
    // 보고 있는 달도 이번 주도 **오늘이 정한다** — 화면이 넘길 값이 없다.
    'ops.calendarMonth',
    'ops.calendarWeekRange',
    // 앞의 빈칸과 오늘 표시를 서버가 센다. 거르는 일도 서버가 한다.
    'ops.calendarDays',
    'ops.calendarWeek',
  ],
  writes: [],
}
