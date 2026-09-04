import type { Served } from './area'

/**
 * 업무(TASK-01 · EVT-TASK-01 · EVT-TASK-02 · MY-01). 화면 넷이 한 표를 본다.
 *
 * **쓰기가 없다.** 업무를 더하거나 고치는 동작을 명세가 전부 `pending`으로 적어
 * 두었고, 그것은 '아직 안 정했다'는 뜻이다 — 지금 지으면 그 모양을 짓는 것이
 * 아니라 정하는 일이 된다.
 *
 * **문서 둘은 아직 여기 없다**(`task.referenceDocuments`·`task.workDocuments`).
 * `documents` 표를 행사·회의·업무가 함께 쓰므로 그 목록을 주는 자리는 따로 짓는다 —
 * 갈라서 두 번 지으면 같은 표가 화면마다 다른 모양으로 읽힌다.
 */
export const tasks: Served = {
  reads: [
    // 칸반의 열 넷을 status만 바꿔 네 번 부른다.
    'task.board',
    'task.alerts',
    // 같은 표를 보되 어느 행사인지가 하나 더 붙는다.
    'event.taskBoard',
    'event.taskAlerts',
    'task.detail',
    'task.reviewStatus',
    'my.tasks',
    'my.taskAlerts',
    'my.taskTabCounts',
  ],
  writes: [],
}
