import type { Served } from './area'

/**
 * 들어오는 길(SIGN-IN · ONB-01 · ORG-01 · ORG-02 · INV-00 · INV-01).
 *
 * 학교를 검색하고, 단과대와 학부를 좁히고, 초대 코드가 어느 학생회를 가리키는지
 * 확인하는 데까지 통째로 서버에서 온다.
 *
 * 고르는 목록 셋이 특히 그렇다. 그전까지는 **고르는 목록이 전부 개발용 응답이었고**,
 * 표가 진짜여도 고를 것이 가짜면 사람은 없는 학교를 고르고 저장할 때 터진다.
 *
 * 어느 로그인 길이 열려 있는가는 배포가 정한다 — 카카오 열쇠를 안 넣은 배포에서
 * 카카오 단추를 그리면 눌러도 안 되고, 사람은 자기 잘못인 줄 안다.
 */
export const joining: Served = {
  reads: [
    'auth.ways',
    'education.schools',
    'education.colleges',
    'education.departments',
    'org.invitedOrganization',
  ],
  writes: [
    // 누르면 제공자로 떠나고, 돌아올 자리는 서버가 붙인다.
    'auth.signInGoogle',
    'auth.signInKakao',
    'org.create',
    'organization.verifyInviteCode',
  ],
}
