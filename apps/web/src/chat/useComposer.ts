import { useEffect, useRef, useState } from 'react'
import { SendMessageSchema, type RoomParticipant, type SendMessageRequest } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { SEND_FAILED } from '@/lib/messages'
import { isRoomLost, messagesPath, sendErrorText } from './chat-api'
import { draftOf, keepDraft } from './composer-drafts'
import { mentionIds } from './mention'
import { usePhotoDrafts } from './usePhotoDrafts'

type Args = {
  councilId: string
  // 내 멤버 id. 보내지 않은 글을 사람마다 따로 둔다.
  meId: string
  roomId: string
  // 보낸 뒤 흐름과 방 목록을 다시 읽게 한다.
  onSent: () => void
  // 방을 잃었다(401·403·404).
  onLost: () => void
  // 답글 입력칸이면 원글 번호(022 조각 11). 쓰던 글은 원글마다 따로 남는다.
  replyTo?: string | undefined
}

// 보내지 않은 글을 두는 칸. 답글은 방 입력칸과 섞이지 않게 원글마다 따로 둔다.
const draftSlot = (roomId: string, replyTo: string | undefined) =>
  replyTo ? `${roomId}/reply/${replyTo}` : roomId

// 보낸 글을 뺀 나머지. 보낸 글 뒤에 이어 쳤으면 그 부분만 남고, 중간을 고쳤으면 고친 글을 그대로 둔다.
function unsentBody(now: string, sent: string) {
  if (now === sent) return ''
  return now.startsWith(sent) ? now.slice(sent.length).trimStart() : now
}

// 글과 부른 사람. 방을 바꿔 입력칸이 사라져도 보내지 않은 글은 남는다.
function useDraft(meId: string, councilId: string, roomId: string) {
  const [body, setBody] = useState(() => draftOf(meId, councilId, roomId).body)
  const [picks, setPicks] = useState<RoomParticipant[]>(
    () => draftOf(meId, councilId, roomId).picks,
  )
  useEffect(() => {
    keepDraft(meId, councilId, roomId, { body, picks })
  }, [meId, councilId, roomId, body, picks])
  return { body, setBody, picks, setPicks }
}

// 입력칸 하나: 글, 부른 사람, 사진, 보내기. 보내기에 실패하면 글과 사진을 그대로 두고 자동으로 다시 보내지 않는다.
export function useComposer({ councilId, meId, roomId, onSent, onLost, replyTo }: Args) {
  const slot = draftSlot(roomId, replyTo)
  const { body, setBody, picks, setPicks } = useDraft(meId, councilId, slot)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 보내다 보기만 되는 방이 된 것을 알게 되면 입력칸을 닫는다.
  const [readOnly, setReadOnly] = useState(false)
  const busy = useRef(false)
  const isActive = useActive()
  const drafts = usePhotoDrafts(councilId, roomId, onLost)
  const { photos } = drafts

  const mentions = mentionIds(body, picks)
  const hasPhotos = photos.length > 0
  // 글은 계약의 `safeParse`로 가른다. 사진이 있으면 글이 비어도 된다.
  const textOk =
    SendMessageSchema.safeParse({ body, mentions }).success || (hasPhotos && body.trim() === '')
  const pending = photos.some(photo => photo.state !== 'ready')
  const canSend = textOk && !pending && !sending

  const send = async () => {
    if (busy.current || !canSend) return
    busy.current = true
    setSending(true)
    setError(null)
    const keys = photos.flatMap(photo => (photo.key ? [photo.key] : []))
    const payload: SendMessageRequest = {
      ...(body.trim() === '' ? {} : { body }),
      mentions,
      photos: keys,
      ...(replyTo ? { replyTo } : {}),
    }
    // 보내는 중에 방을 떠나도 보낸 글이 임시 글로 되살아나지 않게, 먼저 비우고 실패하면 되돌린다.
    keepDraft(meId, councilId, slot, { body: '', picks: [] })
    const result = await postJson(messagesPath(councilId, roomId), payload)
    busy.current = false
    if (!result.ok) keepDraft(meId, councilId, slot, { body, picks })
    if (!isActive()) return
    setSending(false)
    if (result.ok) {
      // 보낸 것만 지운다. 기다리는 사이 이어 친 글과 새로 고른 사진은 남긴다.
      setBody(now => unsentBody(now, body))
      drafts.removeSent(keys)
      onSent()
    } else if (isRoomLost(result.status)) onLost()
    else if (result.code === 'ROOM_READ_ONLY') {
      setReadOnly(true)
      onSent()
    } else setError(sendErrorText(result, SEND_FAILED))
  }

  const pick = (person: RoomParticipant) =>
    setPicks(list =>
      list.some(item => item.memberId === person.memberId) ? list : [...list, person],
    )

  return { body, setBody, pick, send, canSend, sending, error, readOnly, drafts }
}
export type Composer = ReturnType<typeof useComposer>
