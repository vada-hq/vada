import { useRef, useState } from 'react'
import { SendMessageSchema, type RoomParticipant, type SendMessageRequest } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { useActive } from '@/lib/use-active'
import { SEND_FAILED } from '@/lib/messages'
import { isRoomLost, messagesPath, sendErrorText } from './chat-api'
import { mentionIds } from './mention'
import { usePhotoDrafts } from './usePhotoDrafts'

type Args = {
  councilId: string
  roomId: string
  // 보낸 뒤 흐름과 방 목록을 다시 읽게 한다.
  onSent: () => void
  // 방을 잃었다(401·403·404).
  onLost: () => void
}

// 입력칸 하나: 글, 부른 사람, 사진, 보내기. 보내기에 실패하면 글과 사진을 그대로 두고 자동으로 다시 보내지 않는다.
export function useComposer({ councilId, roomId, onSent, onLost }: Args) {
  const [body, setBody] = useState('')
  const [picks, setPicks] = useState<RoomParticipant[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    }
    const result = await postJson(messagesPath(councilId, roomId), payload)
    busy.current = false
    if (!isActive()) return
    setSending(false)
    if (result.ok) {
      setBody('')
      setPicks([])
      drafts.clear()
      onSent()
    } else if (isRoomLost(result.status)) onLost()
    else setError(sendErrorText(result, SEND_FAILED))
  }

  const pick = (person: RoomParticipant) =>
    setPicks(list =>
      list.some(item => item.memberId === person.memberId) ? list : [...list, person],
    )

  return { body, setBody, pick, send, canSend, sending, error, drafts }
}
export type Composer = ReturnType<typeof useComposer>
