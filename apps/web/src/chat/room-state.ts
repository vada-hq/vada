import type {
  ChatMessage,
  MadeRecord,
  MessagePageResponse,
  RoomDetailResponse,
  RoomParticipant,
  RoomSummary,
} from '@vada/contracts'
import { getJson } from '@/lib/api'
import { isRoomLost, roomPath } from './chat-api'

export type RoomState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  // 401·403·404: 흐름을 비우고 "이 방을 볼 수 없어요"를 보인다.
  | { kind: 'lost' }
  | {
      kind: 'ready'
      room: RoomSummary
      participants: RoomParticipant[]
      messages: ChatMessage[]
      hasOlder: boolean
      // 새 메시지를 읽지 못하고 있다(연결 문제). 보이던 흐름은 그대로 둔다.
      syncFailed?: boolean
    }

// 방의 정보와 가장 최근 메시지 쪽을 함께 읽는다.
export async function loadRoom(councilId: string, roomId: string): Promise<RoomState> {
  const base = roomPath(councilId, roomId)
  const [detail, page] = await Promise.all([
    getJson<RoomDetailResponse>(base),
    getJson<MessagePageResponse>(`${base}/messages`),
  ])
  if (detail.ok && page.ok)
    return {
      kind: 'ready',
      room: detail.data.room,
      participants: detail.data.participants,
      messages: page.data.messages,
      hasOlder: page.data.hasOlder,
    }
  // 하나라도 잃었으면(401·403·404) 다른 쪽이 어떻든 잃은 것이다.
  const lost = [detail, page].some(result => !result.ok && isRoomLost(result.status))
  return lost ? { kind: 'lost' } : { kind: 'failed' }
}

export type RoomAt = { councilId: string; roomId: string }

// 커서 앞(before) 또는 뒤(after)의 메시지 쪽. 커서가 없으면 가장 최근 쪽이다.
export function readMessages(
  { councilId, roomId }: RoomAt,
  cursor?: { before: string } | { after: string },
) {
  const query = cursor ? `?${new URLSearchParams(cursor).toString()}` : ''
  return getJson<MessagePageResponse>(`${roomPath(councilId, roomId)}/messages${query}`)
}

// 한 번의 따라잡기에서 이어 읽는 쪽 수의 상한. 서버가 계속 새 쪽을 주어도 끝이 있게 한다.
const MAX_CATCH_UP_PAGES = 20

// 마지막 메시지 뒤를 쪽마다 onPage에 넘긴다. 다음 쪽이 더 있으면 이어서 읽는다. onPage가 false를 주면(화면이 사라짐) 멈춘다.
export async function readNewer(
  where: RoomAt,
  start: string | undefined,
  onPage: (messages: ChatMessage[]) => boolean,
): Promise<'done' | 'lost' | 'failed'> {
  let after = start
  for (let pages = 0; pages < MAX_CATCH_UP_PAGES; pages++) {
    // 다음 쪽의 커서는 이 쪽의 끝이라 차례로 읽는다.
    const result = await readMessages(where, after ? { after } : undefined)
    if (!result.ok) return isRoomLost(result.status) ? 'lost' : 'failed'
    if (!onPage(result.data.messages)) return 'done'
    after = result.data.messages.at(-1)?.id ?? after
    if (!result.data.hasNewer) return 'done'
  }
  return 'done'
}

// 비운 본문은 늦은 응답으로 되살리지 않는다. 삭제 확인은 새 글의 커서를 건너뛰지 않게 기존 줄만 바꾼다.
export function refreshed(state: RoomState, more: ChatMessage[]): RoomState {
  if (state.kind !== 'ready') return state
  const latest = new Map(more.map(item => [item.id, item]))
  return {
    ...state,
    messages: state.messages.map(item => {
      const incoming = latest.get(item.id) ?? item
      return item.body === null
        ? { ...incoming, body: null, photos: [], deletedAt: incoming.deletedAt ?? item.deletedAt }
        : incoming
    }),
  }
}

// 기존 줄은 최신 응답으로 바꾸고 새 줄만 붙인다.
export function appended(state: RoomState, more: ChatMessage[]): RoomState {
  const current = refreshed(state, more)
  if (current.kind !== 'ready') return current
  const known = new Set(current.messages.map(item => item.id))
  return {
    ...current,
    messages: [...current.messages, ...more.filter(item => !known.has(item.id))],
  }
}

export function prepended(state: RoomState, older: MessagePageResponse): RoomState {
  if (state.kind !== 'ready') return state
  return { ...state, hasOlder: older.hasOlder, messages: [...older.messages, ...state.messages] }
}

export function withSync(state: RoomState, syncFailed: boolean): RoomState {
  return state.kind === 'ready' ? { ...state, syncFailed } : state
}

// 같은 방에서 적은 지출을 즉시 잇는다. 재조회와 중복 알림이 와도 같은 기록은 한 번만 둔다.
export function withMade(state: RoomState, messageId: string, made: MadeRecord): RoomState {
  if (state.kind !== 'ready') return state
  return {
    ...state,
    messages: state.messages.map(item =>
      item.id === messageId
        ? { ...item, made: [...(item.made ?? []).filter(known => known.id !== made.id), made] }
        : item,
    ),
  }
}
