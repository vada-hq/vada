import { useRef, useState } from 'react'
import { EditMessageSchema, type ChatMessage } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { changeErrors } from '@/lib/change-errors'
import { SEND_ERRORS } from '@/lib/messages'
import { useActive } from '@/lib/use-active'
import { messagePath } from './chat-api'

const FAILED = '메시지를 고치지 못했어요. 다시 시도해 주세요.'
const INVALID = '메시지 내용을 확인해 주세요.'
const ERRORS = changeErrors({
  NOT_FOUND: '이 메시지를 고칠 수 없어요.',
  MESSAGE_INVALID: '이 메시지를 고칠 수 없어요.',
  ROOM_ARCHIVED: '완료된 행사의 방이라 고칠 수 없어요.',
  MESSAGE_LINKED: SEND_ERRORS.MESSAGE_LINKED!,
  INVALID_INPUT: INVALID,
})

function useEditDraft() {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const fail = (error: string) => {
    setError(error)
    input.current?.focus()
  }
  return {
    open,
    body,
    setBody,
    error,
    input,
    fail,
    setOpen,
    begin: (body: string) => {
      setBody(body)
      setError(null)
      setOpen(true)
    },
    check: () => {
      const parsed = EditMessageSchema.safeParse({ body })
      if (parsed.success) {
        setError(null)
        return parsed.data
      }
      fail(INVALID)
      return null
    },
  }
}

function useEditRequest(councilId: string, messageId: string) {
  const [saved, setSaved] = useState<ChatMessage | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const isActive = useActive()
  const save = async (body: { body: string }) => {
    if (pending.current) return undefined
    pending.current = true
    setBusy(true)
    const result = await postJson<ChatMessage>(messagePath(councilId, messageId), body)
    pending.current = false
    if (!isActive()) return undefined
    setBusy(false)
    if (!result.ok) return ERRORS[result.code] ?? FAILED
    setSaved(result.data)
    return null
  }
  return { saved, busy, isPending: () => pending.current, save }
}

export function useMessageEdit(councilId: string, original: ChatMessage) {
  const draft = useEditDraft()
  const request = useEditRequest(councilId, original.id)
  const { saved } = request
  const message =
    original.body !== null && saved?.editedAt && saved.editedAt > (original.editedAt ?? '')
      ? { ...original, body: saved.body, editedAt: saved.editedAt }
      : original
  const close = () => {
    if (!request.isPending()) draft.setOpen(false)
  }
  const save = async () => {
    if (request.isPending()) return
    const parsed = draft.check()
    if (!parsed) return
    if (parsed.body === message.body) {
      close()
      return
    }
    const error = await request.save(parsed)
    if (error === null) draft.setOpen(false)
    else if (error !== undefined) draft.fail(error)
  }
  return {
    ...draft,
    message,
    busy: request.busy,
    save,
    close,
    begin: () => draft.begin(message.body ?? ''),
  }
}
