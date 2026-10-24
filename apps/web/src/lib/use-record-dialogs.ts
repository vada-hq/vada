import { useState } from 'react'
import { releaseRecord } from './app-location'

// 목록 화면(업무, 구매 요청)의 대화상자 상태: 열린 기록, 만들기 열림, 잃은 이유.
// 잃은 이유(기록이 사라졌거나 권한을 잃음)는 다음에 무엇을 열면 지운다.
// initialCreate면 만들기가 열린 채 시작한다(행사 개요의 '업무 만들기'처럼 다른 화면에서 만들러 왔을 때).
export function useRecordDialogs(initialId?: string, initialCreate = false) {
  const [openId, setOpenId] = useState<string | null>(initialId ?? null)
  const [creating, setCreating] = useState(initialCreate)
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
