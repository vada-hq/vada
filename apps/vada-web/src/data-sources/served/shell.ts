import type { Served } from './area'

/**
 * 셸이 읽는 둘.
 *
 * **화면의 요소가 아니라 화면을 감싼 것의 값이다.** 이 둘이 가짜인 동안은 로그인해도
 * 남의 학생회 이름이 보인다.
 */
export const shell: Served = {
  reads: [
    'shell.organization',
    'shell.viewer',
    // 셸의 이름 자리에서 열리는 화면 하나(MY-INFO-01). 어느 갈피에도 속하지 않아
    // 여기 둔다 — 온보딩에서 받아 둔 학적을 되돌려 주는 자리다.
    'my.profile',
    'my.belonging',
    'my.colleges',
    'my.departments',
  ],
  writes: ['my.saveProfile'],
}
