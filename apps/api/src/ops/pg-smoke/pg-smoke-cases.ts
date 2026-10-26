import { closeAndSpendCase, mainAccountTogetherCase } from './pg-smoke-account-cases.js'
import { finishTogetherCase } from './pg-smoke-finish-case.js'
import { noticeAndRequestTogetherCase } from './pg-smoke-notice-case.js'
import { expenseTogetherCase } from './pg-smoke-expense-cases.js'
import { sendAndRemoveCase, sendTogetherCase } from './pg-smoke-chat-cases.js'
import {
  createAndJoinCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
} from './pg-smoke-join-cases.js'
import type { SmokeCase } from './pg-smoke-kit.js'
import {
  cancelAndDecideCase,
  cancelItemAndPayCase,
  decideTogetherCase,
} from './pg-smoke-purchase-cases.js'
import { cancelAndCheckInCase, sameQrTogetherCase } from './pg-smoke-attendance-cases.js'
import { confirmAndCancelTogetherCase, confirmTogetherCase } from './pg-smoke-deposit-cases.js'
import {
  completeAndApplyCase,
  completeAndConfirmCase,
  completeAndSpendCase,
} from './pg-smoke-complete-cases.js'
import {
  publishAndCompleteCase,
  publishAndSpendCase,
  publishTogetherCase,
} from './pg-smoke-closing-cases.js'
import { sameCommandTogetherCase, sameExpenseTogetherCase } from './pg-smoke-command-cases.js'
import { lastSeatTogetherCase } from './pg-smoke-registration-cases.js'
import { moveTogetherCase } from './pg-smoke-move-case.js'
import { eventRoomsTogetherCase } from './pg-smoke-event-room-case.js'
import { sessionDuringJoinCase } from './pg-smoke-session-case.js'
import { assignAndRemoveCase, changeStatusTogetherCase } from './pg-smoke-task-cases.js'
import { writePathCase } from './pg-smoke-write-case.js'
import { purchaseEstimateCase } from './pg-smoke-purchase-estimate-case.js'

// 실제 PostgreSQL에서 돌리는 점검 사례의 목록. 사례마다 새 시험 사용자와 학생회를 만든다.
// 동시에 움직이는 쪽은 연결을 따로 열어(ctx.connect) Promise.allSettled로 함께 시작한다. PGlite는 거래를 하나씩 돌리므로
// 이 사례들의 동시성은 PGlite로 증명하지 못한다. 시험은 사례의 준비와 판정이 맞는지만 본다(pg-smoke-cases.test.ts).

export type { SmokeCase, SmokeContext, SmokeVerdict } from './pg-smoke-kit.js'
export { unexpectedFailures } from './pg-smoke-kit.js'
export {
  assignAndRemoveCase,
  completeAndApplyCase,
  completeAndConfirmCase,
  completeAndSpendCase,
  confirmAndCancelTogetherCase,
  cancelAndCheckInCase,
  cancelAndDecideCase,
  cancelItemAndPayCase,
  changeStatusTogetherCase,
  confirmTogetherCase,
  createAndJoinCase,
  decideTogetherCase,
  expenseTogetherCase,
  finishTogetherCase,
  noticeAndRequestTogetherCase,
  joinTwiceCase,
  lastSeatTogetherCase,
  moveTogetherCase,
  publishAndCompleteCase,
  publishAndSpendCase,
  publishTogetherCase,
  rotateTogetherCase,
  sameCommandTogetherCase,
  sameExpenseTogetherCase,
  sameQrTogetherCase,
  sendAndRemoveCase,
  sendTogetherCase,
  sessionDuringJoinCase,
  transferAndRemoveCase,
  writePathCase,
}

export const smokeCases: readonly SmokeCase[] = [
  writePathCase,
  purchaseEstimateCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
  moveTogetherCase,
  createAndJoinCase,
  sessionDuringJoinCase,
  sendAndRemoveCase,
  sendTogetherCase,
  assignAndRemoveCase,
  changeStatusTogetherCase,
  decideTogetherCase,
  cancelAndDecideCase,
  cancelItemAndPayCase,
  finishTogetherCase,
  noticeAndRequestTogetherCase,
  expenseTogetherCase,
  mainAccountTogetherCase,
  closeAndSpendCase,
  lastSeatTogetherCase,
  sameCommandTogetherCase,
  sameExpenseTogetherCase,
  sameQrTogetherCase,
  cancelAndCheckInCase,
  confirmTogetherCase,
  confirmAndCancelTogetherCase,
  completeAndSpendCase,
  completeAndConfirmCase,
  completeAndApplyCase,
  publishTogetherCase,
  publishAndSpendCase,
  publishAndCompleteCase,
  eventRoomsTogetherCase,
]
