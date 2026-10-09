import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { CreatePurchaseDraftsSchema, type PurchaseCandidate } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import CandidateCard from './CandidateCard'
import { priceNotice } from './purchase-view'
import type { Candidates } from './useCandidates'
import type { PurchaseResult } from './useEventPurchases'

type Props = {
  candidates: Candidates
  generating: boolean
  onAdd: (ids: string[]) => Promise<PurchaseResult>
  onShowMessage: (messageId: string) => void
}

// 행사 대화에 올라온 쿠팡 링크. 고르기는 사람마다 따로고, 숨김·요청됨은 모두에게 보인다(2026-10-04 결정).
export default function PurchaseCandidates({ candidates: state, generating, onAdd, onShowMessage }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [undo, setUndo] = useState<PurchaseCandidate | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  if (!state.candidates) return state.loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">후보를 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={state.refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">후보 불러오는 중…</StateMessage>
  const all = state.candidates
  const visible = all.filter(candidate => !candidate.hidden)
  const hidden = all.filter(candidate => candidate.hidden)
  const chosen = selected.filter(id => visible.some(candidate => candidate.id === id))
  // 담기 버튼은 서버와 같은 스키마로 켠다. 개수 상한을 화면에 다시 적지 않는다.
  const valid = CreatePurchaseDraftsSchema.safeParse({ idempotencyKey: 'check', candidateIds: chosen }).success
  async function add() {
    setMessage('')
    const result = await onAdd(chosen)
    if (result.ok) setSelected([])
    else setMessage(result.message)
  }
  async function setHidden(candidate: PurchaseCandidate, hide: boolean) {
    setMessage('')
    const result = await state.setHidden(candidate, hide)
    if (!result.ok) { setMessage(result.message); return }
    setUndo(hide ? candidate : null)
    if (hide) setSelected(previous => previous.filter(id => id !== candidate.id))
  }
  return <div className="flex flex-col gap-3">
    <p className="text-xs text-gray-500">{priceNotice}</p>
    {state.truncated && <StateMessage kind="notice">최근 300개만 보여요.</StateMessage>}
    {undo && <div className="flex flex-wrap items-center gap-2">
      <StateMessage kind="notice">후보를 숨겼어요.</StateMessage>
      <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void setHidden(undo, false)}>되돌리기</Button>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
    {all.length === 0 && <Card><EmptyState icon={Link2} title="아직 올라온 쿠팡 링크가 없어요" description="대화에 쿠팡 상품 링크를 올리면 여기에 모여요." /></Card>}
    {visible.length > 0 && <>
      <ul className="flex flex-col gap-2" aria-label="후보 목록">{visible.map(candidate => <CandidateCard key={candidate.id} candidate={candidate}
        onShowMessage={onShowMessage} selection={{ checked: chosen.includes(candidate.id), disabled: generating,
          onChange: checked => setSelected(previous => checked ? [...previous, candidate.id] : previous.filter(id => id !== candidate.id)) }}>
        <Button variant="ghost" size="sm" disabled={state.busy || generating} onClick={() => void setHidden(candidate, true)}>숨기기</Button>
      </CandidateCard>)}</ul>
      <div className="flex flex-col gap-2">
        <Button className="self-start" disabled={generating || !valid} onClick={() => void add()}>선택한 {chosen.length}개 담기</Button>
        {generating && <StateMessage kind="loading">담는 중… 최대 약 75초 걸릴 수 있어요. 끝날 때까지 기다려 주세요.</StateMessage>}
      </div>
    </>}
    {hidden.length > 0 && <section aria-label="숨긴 후보" className="flex flex-col gap-2">
      <Button variant="ghost" size="sm" className="self-start" aria-expanded={showHidden} onClick={() => setShowHidden(value => !value)}>숨긴 후보 {hidden.length}</Button>
      {showHidden && <ul className="flex flex-col gap-2">{hidden.map(candidate => <CandidateCard key={candidate.id} candidate={candidate} onShowMessage={onShowMessage}>
        <Button variant="outline" size="sm" disabled={state.busy} onClick={() => void setHidden(candidate, false)}>다시 보이기</Button>
      </CandidateCard>)}</ul>}
    </section>}
  </div>
}
