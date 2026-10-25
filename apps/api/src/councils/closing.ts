import { DAY_MS, dateFromKorean, koreanDateOf } from '@vada/contracts'
import type { Tx } from '../db/types.js'
import { updateRecord } from '../records/records.js'

// 학생회 그만두기(DEC-55, 기능 021 정한 것 15). 학생회가 이메일로 알리면 VADA가 privacy council-close로 표시한다.
// 표시된 학생회는 읽기만 된다(access/authorize.ts, 공개 양식, 초대). 이어 쓰면 표시를 지우고 데이터는 그대로다.
// 사람의 요청을 VADA가 대신 처리하므로 판의 바꾼 사람은 비우고 사유를 남긴다(회장 되찾기와 같은 방식).
export const CLOSING_REASON = '학생회 요청으로 그만두기 표시'
export const REOPEN_REASON = '학생회 요청으로 이어 쓰기'

// 읽기만 열어 두는 기간(DEC-55 '그만둔다고 알린 날부터 30일'). 알린 날은 세지 않고 다음 날부터 30일,
// 30일째 24:00(한국)에 끝난다(민법 제157조 초일 불산입, 제159조 말일 종료). 알린 날(한국 날짜) + 31일의 0시(한국)부터 파기한다.
const READ_ONLY_DAYS = 30
export const destroyableFrom = (closingRequestedAt: Date) =>
  new Date(
    dateFromKorean(`${koreanDateOf(closingRequestedAt)}T00:00`).getTime() +
      (READ_ONLY_DAYS + 1) * DAY_MS,
  )

// 표시와 지우기. 부르는 쪽이 지금 상태를 보고 바뀔 때만 부른다(같은 표시를 다시 하면 30일을 다시 세지 않는다).
export const markClosing = (tx: Tx, councilId: string, at: Date) =>
  updateRecord(tx, {
    kind: 'council',
    id: councilId,
    actor: null,
    reason: CLOSING_REASON,
    changes: { closingRequestedAt: at },
  })

export const clearClosing = (tx: Tx, councilId: string) =>
  updateRecord(tx, {
    kind: 'council',
    id: councilId,
    actor: null,
    reason: REOPEN_REASON,
    changes: { closingRequestedAt: null },
  })
