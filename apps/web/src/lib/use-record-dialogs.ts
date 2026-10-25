import { useState } from 'react'
import { releaseRecord } from './app-location'

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
      // 주소로 연 상세가 사라졌으면 칸을 상위 목록으로 바꿔 쓴다(뒤로 가면 페이지가 새로 그려져 이유가 사라진다).
      releaseRecord()
      setOpenId(null)
      setCreating(false)
      setLost(message)
    },
  }
}
