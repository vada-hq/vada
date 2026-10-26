import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage, MadeRecord, ReplyPageResponse } from '@vada/contracts'
import { useActive } from '@/lib/use-active'
import { useLatest } from '@/lib/use-latest'
import { useVisiblePoll } from '@/lib/use-visible-poll'
import { CHAT_POLL_MS, isRoomLost } from './chat-api'
import {
  loadReplies,
  readReplies,
  withNewer,
  withOlder,
  withReplyMade,
  withReplySync,
  type ReplyAt,
  type ReplyState,
} from './reply-state'
import { readNewer } from './room-state'

type Kit = {
  at: ReplyAt
  state: ReplyState
  setState: (update: (before: ReplyState) => ReplyState) => void
  lose: () => void
  isActive: () => boolean
  // 읽은 쪽마다 새 원글을 알린다.
  onPage: (page: ReplyPageResponse) => void
}

// 보이는 동안 3초마다 마지막 답글 뒤를 이어 읽는다(방 흐름과 같은 따라잡기).
function useCatchUp({ at, state, setState, lose, isActive, onPage }: Kit) {
  const busy = useRef(false)
  const ready = state.kind === 'ready'
  const lastId = ready ? state.replies.at(-1)?.id : undefined
  const catchUp = useCallback(async () => {
    if (busy.current || !ready) return
    busy.current = true
    const outcome = await readNewer(
      cursor => readReplies(at, cursor),
      lastId,
      page => {
        if (!isActive()) return false
        setState(before => withNewer(before, page))
        onPage(page)
        return true
      },
    )
    busy.current = false
    if (!isActive()) return
    if (outcome === 'lost') lose()
    else setState(before => withReplySync(before, outcome === 'failed'))
  }, [at, ready, lastId, lose, isActive, setState, onPage])
  useVisiblePoll(() => void catchUp(), CHAT_POLL_MS)
  return catchUp
}

// 이전 답글 쪽을 읽어 앞에 붙인다. 못 읽으면 false다.
function useOlder({ at, state, setState, lose, isActive }: Kit) {
  const firstId = state.kind === 'ready' ? state.replies[0]?.id : undefined
  return useCallback(async () => {
    if (!firstId) return false
    const result = await readReplies(at, { before: firstId })
    if (!isActive()) return true
    if (!result.ok) {
      if (isRoomLost(result.status)) lose()
      return false
    }
    setState(now => withOlder(now, result.data))
    return true
  }, [at, firstId, lose, isActive, setState])
}

// 원글 하나의 답글(022 조각 11). 방 흐름(useRoom)과 같이 처음엔 가장 최근 쪽을 읽고, 보이는 동안 이어 읽는다.
// 읽을 때마다 원글도 새로 받아 onOriginal로 알린다(방 흐름의 '답글 {n}'을 맞춘다).
export function useReplies(at: ReplyAt, onOriginal: ((original: ChatMessage) => void) | undefined) {
  const { councilId, roomId, messageId } = at
  const where = useMemo(() => ({ councilId, roomId, messageId }), [councilId, roomId, messageId])
  const [state, setState] = useState<ReplyState>({ kind: 'loading' })
  const isActive = useActive()
  const original = useLatest(onOriginal)
  const lose = useCallback(() => setState({ kind: 'lost' }), [])
  const onPage = useCallback(
    (page: ReplyPageResponse) => original.current?.(page.original),
    [original],
  )

  const first = useCallback(async () => {
    setState({ kind: 'loading' })
    const next = await loadReplies(where)
    if (!isActive()) return
    setState(next)
    if (next.kind === 'ready') original.current?.(next.original)
  }, [where, isActive, original])
  useEffect(() => {
    void first()
  }, [first])

  const kit = { at: where, state, setState, lose, isActive, onPage }
  const sync = useCatchUp(kit)
  const loadOlder = useOlder(kit)
  const markMade = useCallback(
    (id: string, made: MadeRecord) => setState(now => withReplyMade(now, id, made)),
    [],
  )
  return { state, retry: first, lose, loadOlder, sync, markMade }
}
