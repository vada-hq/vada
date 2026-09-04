import type { Served } from './area'

/**
 * 밖에서 오는 사람(EXT-01A · EXT-01B · EXT-02A · EXT-02B · EXT-02C).
 *
 * 로그인이 없는 흐름이다. 참석 QR을 찍거나 설문 링크를 받은 학생이 여는 자리이고,
 * **링크가 실어 온 토큰 하나가 유일한 벽이다** — 세션이 한 번도 없다.
 *
 * 고르는 목록이 그 학생회가 올린 명단에서 온다. 화면이 지어내면 명단에 없는 학과를
 * 고른 사람이 생기고, 그 사람은 참가 자격 판정에서 걸린다.
 */
export const outside: Served = {
  reads: [
    'attendance.checkInForm',
    'attendance.checkInResult',
    'survey.applyForm',
    'survey.applyResult',
    'survey.linkState',
    'survey.colleges',
    'survey.departments',
  ],
  // 참석은 QR이, 신청은 설문 링크가 자리를 정한다.
  writes: ['attendance.checkIn', 'survey.apply'],
}
