import type { Served } from './area'

/**
 * 운영 공간 그 자체(OPS-00 · OPS-CAL-01).
 *
 * **회의와 가른다.** 회의는 `meetings.ts`가 든다. 여기 오는 것은 업무·회의·행사·마감을
 * 가로질러 세는 것이다 — 어느 한 영역에 두면 그 영역이 남의 표를 읽게 된다.
 *
 * 아직 안 올린 것 넷: 달력의 `ops.calendarMonth`·`ops.calendarDays`·
 * `ops.calendarWeekRange`·`ops.calendarWeek`. 달력이 모으는 셋(행사·회의·마감) 중
 * 마감의 규칙만 그림에 있고(`마감은 완료되지 않은 업무 기준`) 나머지는 다음 회차다.
 */
export const ops: Served = {
  reads: [
    // 보는 사람의 이름이 들어가는 문장이라 서버가 완성해서 준다.
    'ops.intro',
    // 공간 넷은 제품이 정한 고정 구조라 명세가 갖고, 건수만 서버가 준다.
    'ops.spaceStats',
  ],
  writes: [],
}
