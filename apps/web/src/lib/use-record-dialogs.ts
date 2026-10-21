import { useState } from 'react'

// 목록 화면(업무, 구매 요청)의 대화상자 상태: 열린 기록, 만들기 열림, 잃은 이유.
// 잃은 이유(기록이 사라졌거나 권한을 잃음)는 다음에 무엇을 열면 지운다.
export function useRecordDialogs(initialId?: string) {
  const [openId, setOpenId] = useState<string | null>(initialId ?? null)
  const [creating, setCreating] = useState(false)
  const [lost, setLost] = useState<string | null>(null)
  return {
    openId,
    creating,
    lost,
    openRecord: (id: string) => {
      setLost(null)
      setOpenId(id)
    },
    startCreate: () => {
      setLost(null)
      setCreating(true)
    },
    closeDetail: () => setOpenId(null),
    closeCreate: () => setCreating(false),
    lose: (message: string) => {
      setOpenId(null)
      setCreating(false)
      setLost(message)
    },
  }
}
