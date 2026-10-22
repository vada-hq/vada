import { useState } from 'react'
import type { Applicant, ApplicantDeposit } from '@vada/contracts'

type Patch = Pick<Applicant, 'cancelled' | 'deposit'>

// 서버에서 읽은 신청자 위에 이 화면에서 바꾼 입금 상태와 취소를 덮는다(목록을 다시 읽지 않는다: 읽을 때마다 열람 기록이 남는다).
// 줄을 빼는 때: 신청이 없어졌거나(404), 입금 없이 취소했거나, 환불함·환불 대기의 확인 취소로 이름이 비었다.
export function useApplicantRows(applicants: Applicant[], onCancelled: () => void) {
  const [patches, setPatches] = useState<ReadonlyMap<string, Patch>>(new Map())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())
  // 서버에서 새로 읽었으면 서버 값이 더 새롭다. 덮은 것을 버린다(렌더 중에 맞추는 방식이다).
  const [source, setSource] = useState(applicants)
  if (source !== applicants) {
    setSource(applicants)
    setPatches(new Map())
    setRemoved(new Set())
  }
  const remove = (id: string) => setRemoved(before => new Set(before).add(id))
  const rows = applicants
    .filter(item => !removed.has(item.id))
    .map(item => ({ ...item, ...patches.get(item.id) }))

  // 입금한 신청의 취소는 줄이 남아 환불 대기로 바뀐다. 입금 금액은 그대로다.
  function cancelled(id: string, refundPending: boolean) {
    const row = rows.find(item => item.id === id)
    if (refundPending && row)
      setPatches(before =>
        new Map(before).set(id, {
          cancelled: true,
          deposit: { status: 'refund_pending', amount: row.deposit.amount },
        }),
      )
    else remove(id)
    onCancelled()
  }

  function deposited(id: string, deposit: ApplicantDeposit) {
    const row = rows.find(item => item.id === id)
    // 환불했거나 환불 대기의 입금 확인을 취소하면 이름이 비어 줄이 사라진다.
    if (deposit.status === 'refunded' || (row?.cancelled && deposit.status === 'none'))
      return remove(id)
    setPatches(before => new Map(before).set(id, { cancelled: row?.cancelled ?? false, deposit }))
  }

  return { rows, cancelled, deposited }
}
