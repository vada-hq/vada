import type { Served } from './area'

/**
 * 셸이 읽는 둘.
 *
 * **화면의 요소가 아니라 화면을 감싼 것의 값이다.** 이 둘이 가짜인 동안은 로그인해도
 * 남의 학생회 이름이 보인다.
 */
export const shell: Served = {
  reads: ['shell.organization', 'shell.viewer'],
  writes: [],
}
