import type { Served } from './area'

/**
 * 행사 — 앞자락(EVT-00A · EVT-00B · EVT-02 · EVT-02B · EVT-04B)과 행사 공간의
 * 갈피들(EVT-01 · EVT-02C · EVT-02E · EVT-03A · EVT-05B · EVT-MEET-01 ·
 * EVT-SCHED-01).
 *
 * 앞자락의 자리들은 서버가 이미 답하고 있었는데 화면은 개발용 응답을 그렸다 —
 * **자리를 만든 것과 그 자리가 쓰이는 것은 다른 일이다.**
 */
export const events: Served = {
  reads: [
    // 인자를 넘겨 부르는 길이 열린 것을 재는 자리였다.
    'event.summary',
    // **행사 작업공간의 셸.** 화면의 요소가 아니라 화면을 감싼 것이 읽는다 —
    // 서버는 처음부터 답하고 있었는데 이 목록에 없어서, 행사 안쪽 화면들이
    // 전부 개발용 응답으로 그 머리를 그렸다.
    'event.workspace',
    'event.list',
    'event.basics',
    'event.basicsDraft',
    'event.attendanceQr',

    // **행사 공간의 갈피 일곱.** 여기까지가 한 행사를 열어 놓고 도는 자리다.
    //
    // 두 모달(EVT-02C·EVT-02E)이 말하는 '누가 할 수 있는가'는 권한 행렬에서
    // 만든 글이다 — 화면이 역할 이름을 들면 조직 규칙이 바뀔 때 조용히 틀린다.
    'event.endPermission',
    'event.completeConfirm',
    // 행사 운영 조직(EVT-01·EVT-03A). 학생회의 기본 조직과 **다른 물건이다.**
    'event.staffLeaders',
    'event.staffDepartments',
    'event.staffSetupPreview',
    // 고르는 목록도 같은 서버에서 온다 — 표는 진짜인데 고를 것이 가짜면
    // 사람은 없는 사람을 고르고 저장할 때 터진다.
    'event.staffLeaderCandidates',
    // 참여 설문(EVT-05B).
    'event.survey',
    'event.surveyReplaceImpact',
    // 행사에 걸린 회의와 일정(EVT-MEET-01·EVT-SCHED-01). 일정은 **원본이 아니라
    // 비친 것이다** — 업무 마감·회의 일시·행사 기본정보가 각자 원본이다.
    'event.meetingCounts',
    'event.meetings',
    'event.schedule',
  ],
  // QR 다시 만들기는 되돌릴 수 없다 — 뿌려 둔 포스터의 QR이 전부 죽는다.
  writes: [
    'event.create',
    'event.saveBasics',
    'event.attendanceQr.regenerate',
    'event.attendanceQr.deactivate',
  ],
}
