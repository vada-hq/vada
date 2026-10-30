import type { RoomParticipant } from '@vada/contracts'

// 보내지 않은 글: 방을 바꿨다 돌아와도 남게 메모리에 둔다(새로 고침 전까지, DEC-78 이동 10).
// 저장소(localStorage)에는 쓰지 않는다: 다 쓰지 않은 사적인 글을 기기에 남기지 않는다.
// 열쇠에 내 멤버 id를 넣어, 같은 브라우저에서 로그인한 다른 사람이 앞 사람의 글을 보지 않게 한다.
export type Draft = { body: string; picks: RoomParticipant[] }
const EMPTY: Draft = { body: '', picks: [] }
const drafts = new Map<string, Draft>()

export const draftKey = (meId: string, councilId: string, roomId: string) =>
  `${meId}/${councilId}/${roomId}`

export const draftOf = (meId: string, councilId: string, roomId: string) =>
  drafts.get(draftKey(meId, councilId, roomId)) ?? EMPTY

export function keepDraft(meId: string, councilId: string, roomId: string, draft: Draft) {
  const key = draftKey(meId, councilId, roomId)
  if (draft.body === '' && draft.picks.length === 0) drafts.delete(key)
  else drafts.set(key, draft)
}

// 시험용: 앞 시험이 남긴 글을 비운다.
export const resetDrafts = () => drafts.clear()
