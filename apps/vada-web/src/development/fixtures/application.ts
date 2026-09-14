import type { DataRow } from '../../data-sources/definitions'

export const APPLICATION_DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  // 셸 — 모든 데스크톱 화면이 공유한다.
  // 어느 길이 열려 있는가(SIGN-IN). 배포가 정하므로 진짜는 서버가 답한다.
  'auth.ways': { google: true, kakao: true },
  'shell.organization': { name: '소프트웨어융합대학' },
  'shell.viewer': { name: '박해랑', role: '운영부 · 부원' },

  // 내 정보(MY-INFO-01). **고르는 값은 코드와 이름표가 함께 온다** — 코드만 주면
  // 화면이 열리는 순간 사람이 'COL-…'을 본다.
  'my.profile': {
    name: '김바다',
    studentNumber: '2022123456',
    schoolName: '한양대학교 ERICA',
    college: 'COL-HYU-ERICA-SW',
    collegeName: '소프트웨어융합대학',
    department: 'DEP-HYU-ERICA-SW-ICT',
    departmentName: 'ICT융합학부',
    currentGrade: '3',
    currentGradeName: '3학년',
  },
  // 소속은 고치는 값이 아니라 읽는 값이라 출처가 갈려 있다.
  'my.belonging': {
    orgName: '제12대 소프트웨어융합대학 학생회',
    orgDepartment: '회장단',
    executiveTitle: '회장',
  },

  // 앱을 열면 어디부터인가. **서버가 세션을 보고 정한다** — 개발용 응답으로 도는
  // 동안은 그림을 보러 온 것이므로 이미 들어온 사람의 자리를 준다.
  'app.start': { screenId: 'HOME-01K' },
}
