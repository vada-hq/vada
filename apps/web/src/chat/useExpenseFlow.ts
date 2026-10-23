import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'

// 메시지에서 지출을 적는 흐름의 상태: 적고 있는 메시지, 적은 뒤 열린 지출(그 메시지의 사진 번호와 함께), 잃은 이유.
export function useExpenseFlow() {
  const [writing, setWriting] = useState<ChatMessage | null>(null)
  const [made, setMade] = useState<{ expenseId: string; photoIds: string[] } | null>(null)
  const [lost, setLost] = useState<string | null>(null)
  return {
    writing,
    made,
    lost,
    start: (message: ChatMessage) => {
      setMade(null)
      setLost(null)
      setWriting(message)
    },
    close: () => setWriting(null),
    finish: (expenseId: string) => {
      setMade({ expenseId, photoIds: writing?.photos.map(photo => photo.id) ?? [] })
      setWriting(null)
    },
    closeDetail: () => setMade(null),
    lose: (reason: string) => {
      setWriting(null)
      setMade(null)
      setLost(reason)
    },
  }
}
export type ExpenseFlow = ReturnType<typeof useExpenseFlow>
