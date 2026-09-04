import type { Served } from './area'

/**
 * 행사의 앞자락(EVT-00A · EVT-00B · EVT-02 · EVT-02B · EVT-04B).
 *
 * 서버는 이 자리들을 이미 답하고 있었는데 화면은 개발용 응답을 그렸다 —
 * **자리를 만든 것과 그 자리가 쓰이는 것은 다른 일이다.**
 */
export const events: Served = {
  reads: [
    // 인자를 넘겨 부르는 길이 열린 것을 재는 자리였다.
    'event.summary',
    'event.list',
    'event.basics',
    'event.basicsDraft',
    'event.attendanceQr',
  ],
  // QR 다시 만들기는 되돌릴 수 없다 — 뿌려 둔 포스터의 QR이 전부 죽는다.
  writes: [
    'event.create',
    'event.saveBasics',
    'event.attendanceQr.regenerate',
    'event.attendanceQr.deactivate',
  ],
}
