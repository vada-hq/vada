import { sendAndRemoveCase, sendTogetherCase } from './pg-smoke-chat-cases.js'
import {
  createAndJoinCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
} from './pg-smoke-join-cases.js'
import type { SmokeCase } from './pg-smoke-kit.js'
import { sessionDuringJoinCase } from './pg-smoke-session-case.js'
import { writePathCase } from './pg-smoke-write-case.js'

// 실제 PostgreSQL에서 돌리는 점검 사례의 목록. 사례마다 새 시험 사용자와 학생회를 만든다.
// 동시에 움직이는 쪽은 연결을 따로 열어(ctx.connect) Promise.allSettled로 함께 시작한다. PGlite는 거래를 하나씩 돌리므로
// 이 사례들의 동시성은 PGlite로 증명하지 못한다. 시험은 사례의 준비와 판정이 맞는지만 본다(pg-smoke-cases.test.ts).

export type { SmokeCase, SmokeContext, SmokeVerdict } from './pg-smoke-kit.js'
export { unexpectedFailures } from './pg-smoke-kit.js'
export {
  createAndJoinCase,
  joinTwiceCase,
  rotateTogetherCase,
  sendAndRemoveCase,
  sendTogetherCase,
  sessionDuringJoinCase,
  transferAndRemoveCase,
  writePathCase,
}

export const smokeCases: readonly SmokeCase[] = [
  writePathCase,
  joinTwiceCase,
  rotateTogetherCase,
  transferAndRemoveCase,
  createAndJoinCase,
  sessionDuringJoinCase,
  sendAndRemoveCase,
  sendTogetherCase,
]
