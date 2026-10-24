import { useEffect, useRef, useState } from 'react'
import { SendMessageSchema, statusOf, type RoomListResponse } from '@vada/contracts'
import { chatBase, messagesPath } from '@/chat/chat-api'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { getJson, postJson } from '@/lib/api'
import {
  PERMISSION_CHANGED,
  ROOM_LOST,
  ROOMS_LOAD_FAILED,
  SEND_ERRORS,
  SEND_FAILED,
} from '@/lib/messages'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import type { TaskDialogHandlers } from './task-requests'

type Props = Pick<TaskDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  taskId: string
  onClose: () => void
  onMade: () => void
}

// 공지를 올릴 방을 찾는다. 서버가 방마다 noticeRoom으로 알려 주고 화면은 방 종류를 다시 판정하지 않는다.
function useAllRoom(councilId: string, handlers: Pick<Props, 'onLost' | 'onForbidden'>) {
  const [roomId, setRoomId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { onLost, onForbidden } = handlers
  useEffect(() => {
    const controller = new AbortController()
    setFailed(false)
    void getJson<RoomListResponse>(`${chatBase(councilId)}/rooms`, controller.signal).then(
      result => {
        if (controller.signal.aborted) return
        if (result.ok) {
          const room = result.data.rooms.find(item => item.noticeRoom)
          return room ? setRoomId(room.id) : setFailed(true)
        }
        if (result.status === statusOf('FORBIDDEN')) {
          onForbidden()
          return onLost(PERMISSION_CHANGED)
        }
        setFailed(true)
      },
    )
    return () => controller.abort()
  }, [councilId, attempt, onLost, onForbidden])
  return { roomId, failed, retry: () => setAttempt(value => value + 1) }
}

// 공지 만들기: 글 하나를 전체방에 공지로 올리고 이 업무에 잇는다(기능 015).
export function NoticeMakeDialog({ councilId, taskId, onClose, onMade, ...handlers }: Props) {
  const room = useAllRoom(councilId, handlers)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)
  const request = { body, notice: true, taskId }
  const parsed = SendMessageSchema.safeParse(request)
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract({ body: requiredText(body, '내용을') }, parsed),
  )

  async function submit() {
    if (!attempt() || !parsed.success || room.roomId === null || sending.current) return
    sending.current = true
    setSaving(true)
    setProblem(null)
    const result = await postJson(messagesPath(councilId, room.roomId), request)
    sending.current = false
    setSaving(false)
    if (result.ok) return onMade()
    if (result.status === statusOf('FORBIDDEN')) {
      handlers.onForbidden()
      return handlers.onLost(PERMISSION_CHANGED)
    }
    // 업무 문제는 서버가 409로 준다. 404는 방이 사라진 경우다.
    if (result.status === statusOf('NOT_FOUND')) return handlers.onLost(ROOM_LOST)
    setProblem(SEND_ERRORS[result.code] ?? SEND_FAILED)
  }

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>공지 만들기</DialogTitle>
        </DialogHeader>
        <form
          ref={formRef}
          noValidate
          aria-label="공지 만들기"
          className="flex flex-col gap-4"
          onSubmit={event => {
            event.preventDefault()
            void submit()
          }}
        >
          <Field label="내용" required error={errors.body}>
            <Textarea
              value={body}
              disabled={saving}
              onChange={event => setBody(event.target.value)}
            />
          </Field>
          {room.failed && <StateMessage kind="error">{ROOMS_LOAD_FAILED}</StateMessage>}
          {problem && <StateMessage kind="error">{problem}</StateMessage>}
          <DialogFooter>
            <Button type="button" variant="outline" busy={saving} onClick={onClose}>
              닫기
            </Button>
            {room.failed ? (
              <Button type="button" onClick={room.retry}>
                다시 시도
              </Button>
            ) : (
              <Button type="submit" busy={saving || room.roomId === null}>
                만들기
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
