import { useState } from 'react'
import type { Applicant, ApplicantChange } from '@vada/contracts'

// 쓰기가 돌려준 줄의 새 모습으로 줄이 목록에서 빠지는가: 환불함이거나, 취소했는데 입금이 없다(이름이 비었다).
const leaves = (change: ApplicantChange) =>
  change.deposit.status === 'refunded' || (change.cancelled && change.deposit.status === 'none')

// 서버에서 읽은 신청자 위에, 이 화면에서 한 쓰기가 돌려준 줄의 새 모습(상태 칸과 actions)을 덮는다.
// 목록을 다시 읽지 않는다(읽을 때마다 열람 기록이 남는다). 동작은 서버가 센 것이라 화면이 다시 세지 않는다.
// 신청이 없어졌으면(404) 그 줄도 뺀다.
export function useApplicantRows(
  applicants: Applicant[],
  changes: ReadonlyMap<string, ApplicantChange>,
) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  // 서버에서 새로 읽었으면 서버 값이 더 새롭다(렌더 중에 맞추는 방식이다).
  const [source, setSource] = useState(applicants)
  if (source !== applicants) {
    setSource(applicants)
    setRemoved(new Set())
  }
  const rows = applicants
    .filter(item => !removed.has(item.id))
    .flatMap(item => {
      const change = changes.get(item.id)
      if (!change) return [item]
      if (leaves(change)) return []
      const { attended, cancelled, deposit, actions } = change
      return [{ ...item, attended, cancelled, deposit, actions }]
    })
  const gone = (id: string) => setRemoved(before => new Set(before).add(id))
  return { rows, gone }
}
