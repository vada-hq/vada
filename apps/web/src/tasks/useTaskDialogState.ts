import { useState } from 'react'

// 업무 화면의 대화상자 상태: 열린 업무, 만들기 열림, 잃은 이유.
// 잃은 이유(업무가 사라졌거나 권한을 잃음)는 다음에 무엇을 열면 지운다.
export function useTaskDialogState() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [lost, setLost] = useState<string | null>(null)
  return {
    openId,
    creating,
    lost,
    openTask: (id: string) => {
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
