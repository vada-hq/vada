import type { Served } from './area'

/**
 * 학생회를 보고 고치는 자리들(ORG-00 · ORG-03A~C · ORG-04 · ORG-04B · ORG-07A · ORG-07C).
 *
 * 같은 저장소를 보는 이웃들이 오랫동안 개발용 응답을 그리고 있었다 — 역할 표만
 * 진짜였다. 초대 코드가 특히 그랬다: **화면이 지어내면 그 코드로는 아무도 못 들어온다.**
 *
 * 명단은 거르는 것도 세는 것도 서버가 한다. 천 명짜리 명단을 화면이 들고 거르면
 * '몇 명인가'의 답이 화면마다 갈린다.
 */
export const org: Served = {
  reads: [
    'org.departments',
    'org.students',
    'org.studentPaging',
    'org.rosterScope',
    'org.areaSummaries',
    // 학생회비 명단을 올릴 때 고르는 학기. **표가 아니라 운영 연도에서 온다.**
    'org.duesTerms',
    'org.chartTitle',
    'org.executives',
    'org.invite',
    'org.roleAssignments',
    'org.roleAssignmentCount',
    'org.selectedRoleAssignment',
    'org.unassignedHint',
    'org.unassignedMembers',
    'org.roleCounts',
    'org.permissionMatrix',
  ],
  // 되돌릴 수 없는 넷. 역할을 바꾸고 초대를 다시 만든다.
  writes: [
    'org.changeRole',
    'org.regenerateInvite',
    'org.regenerateInviteCode',
    'org.regenerateInviteLink',
  ],
}
