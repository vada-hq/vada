import { useRef, useState } from 'react'
import type { ChatMessage } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { DELETE_MESSAGE_ERRORS, DELETE_MESSAGE_FAILED } from '@/lib/messages'
import { useActive } from '@/lib/use-active'
import { chatBase } from './chat-api'

export function useMessageDeletion(councilId: string, messageId: string, onDeleted: () => void) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const isActive = useActive()
  const remove = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    const result = await postJson<ChatMessage>(
      `${chatBase(councilId)}/messages/${encodeURIComponent(messageId)}/delete`,
      {},
    )
    pending.current = false
    if (!isActive()) return
    setBusy(false)
    if (result.ok) {
      setOpen(false)
      onDeleted()
    } else setError(DELETE_MESSAGE_ERRORS[result.code] ?? DELETE_MESSAGE_FAILED)
  }
  return {
    open,
    busy,
    error,
    remove,
    ask: () => {
      setError(null)
      setOpen(true)
    },
    close: () => setOpen(false),
  }
}
