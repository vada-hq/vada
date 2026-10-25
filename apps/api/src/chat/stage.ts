import type { TaskResultStage } from '@vada/contracts'

// 공지가 업무 결과물로서 어느 단계인가(RULE-41, DEC-82, DEC-90). 공지는 공지방에 올린 메시지라 올리면 끝남이다.
// 메시지를 지우거나 공지에서 빼는 길이 없어 빠짐은 없다. 저장하지 않고 DB도 읽지 않는다.
export const noticeStagesOf = (messageIds: readonly string[]): Map<string, TaskResultStage> =>
  new Map(messageIds.map(id => [id, 'finished']))
