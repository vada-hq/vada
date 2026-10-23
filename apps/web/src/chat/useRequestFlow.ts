import { useState } from 'react'
import type { ChatMessage } from '@vada/contracts'

// 메시지에서 구매 요청을 만드는 흐름의 상태: 열린 메시지, 낸 요청(닫힌 뒤 "재정에서 보기"), 잃은 이유.
export function useRequestFlow() {
  const [requesting, setRequesting] = useState<ChatMessage | null>(null)
  const [madeId, setMadeId] = useState<string | null>(null)
  const [lost, setLost] = useState<string | null>(null)
  return {
    requesting,
    madeId,
    lost,
    start: (message: ChatMessage) => {
      setMadeId(null)
      setLost(null)
      setRequesting(message)
    },
    close: () => setRequesting(null),
    finish: (requestId: string) => {
      setRequesting(null)
      setMadeId(requestId)
    },
    lose: (reason: string) => {
      setRequesting(null)
      setLost(reason)
    },
    dismiss: () => {
      setMadeId(null)
      setLost(null)
    },
  }
}
export type RequestFlow = ReturnType<typeof useRequestFlow>
