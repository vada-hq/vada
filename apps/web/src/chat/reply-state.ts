import type { ChatMessage, MadeRecord, ReplyPageResponse } from '@vada/contracts'
import { getJson } from '@/lib/api'
import { isRoomLost, repliesPath } from './chat-api'

// 답글 패널 하나의 상태(022 조각 11). 원글은 읽을 때마다 새로 받아 답글 수와 마지막 답글 시각이 맞는다.
export type ReplyState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // 401·403·404: 원글이나 방을 볼 수 없게 됐다.
  | { kind: 'lost' }
  | {
      kind: 'ready'
      original: ChatMessage
      replies: ChatMessage[]
      hasOlder: boolean
      // 새 답글을 읽지 못하고 있다(연결 문제). 보이던 답글은 그대로 둔다.
      syncFailed?: boolean
    }

export type ReplyAt = { councilId: string; roomId: string; messageId: string }

// 커서 앞(before) 또는 뒤(after)의 답글 쪽. 커서가 없으면 가장 최근 쪽이다.
export function readReplies(
  { councilId, roomId, messageId }: ReplyAt,
  cursor?: { before: string } | { after: string },
) {
  const query = cursor ? `?${new URLSearchParams(cursor).toString()}` : ''
  return getJson<ReplyPageResponse>(`${repliesPath(councilId, roomId, messageId)}${query}`)
}

export async function loadReplies(where: ReplyAt): Promise<ReplyState> {
  const result = await readReplies(where)
  if (result.ok)
    return {
      kind: 'ready',
      original: result.data.original,
      replies: result.data.messages,
      hasOlder: result.data.hasOlder,
    }
  return isRoomLost(result.status) ? { kind: 'lost' } : { kind: 'failed' }
}

// 새로 읽은 쪽을 붙인다. 이미 있는 답글은 다시 붙이지 않고, 원글은 새 값으로 바꾼다.
export function withNewer(state: ReplyState, page: ReplyPageResponse): ReplyState {
  if (state.kind !== 'ready') return state
  const known = new Set(state.replies.map(item => item.id))
  const more = page.messages.filter(item => !known.has(item.id))
  return { ...state, original: page.original, replies: [...state.replies, ...more] }
}

export function withOlder(state: ReplyState, page: ReplyPageResponse): ReplyState {
  if (state.kind !== 'ready') return state
  return { ...state, hasOlder: page.hasOlder, replies: [...page.messages, ...state.replies] }
}

export function withReplySync(state: ReplyState, syncFailed: boolean): ReplyState {
  return state.kind === 'ready' ? { ...state, syncFailed } : state
}

// 패널에서 낸 요청·지출을 그 메시지(원글이나 답글) 아래 기록에 더한다(방 흐름의 withMade와 같다).
export function withReplyMade(state: ReplyState, messageId: string, made: MadeRecord): ReplyState {
  if (state.kind !== 'ready') return state
  const add = (item: ChatMessage) =>
    item.id === messageId && !item.made.some(known => known.id === made.id)
      ? { ...item, made: [...item.made, made] }
      : item
  return { ...state, original: add(state.original), replies: state.replies.map(add) }
}
