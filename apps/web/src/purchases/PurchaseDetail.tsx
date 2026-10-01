import { useEffect, useRef } from 'react'
import type { PurchaseDetail as PurchaseRequest, UpdatePurchaseDraftRequest } from '@vada/contracts'
import DraftForm from './DraftForm'
import FinanceReview from './FinanceReview'
import { analyzeDraft, createDraftValues } from './draft-form-model'
import { purchaseStatusLabels } from './purchase-status'

type Props = {
  request: PurchaseRequest; busy: boolean; stale: boolean; dirty: boolean; finance: boolean
  onDirty: (value: boolean) => void; onSave: (input: UpdatePurchaseDraftRequest) => void
  onDiscard: () => void; onReload: () => void; onSubmit: () => void
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void
  onBack: () => void; onReturnToChat?: () => void
}
export default function PurchaseDetail({ onBack, onReturnToChat, ...props }: Props) {
  const { request, busy } = props
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const element = heading.current
    if (element && !element.closest('[hidden]')) element.focus()
  }, [request.id])
  return <article className="purchase-detail">
    <nav className="purchase-toolbar" aria-label="요청서 이동">
      <button className="button-quiet" disabled={busy} onClick={onBack}>요청 목록으로</button>
      {onReturnToChat && <button className="button-quiet" disabled={busy} onClick={onReturnToChat}>대화로 돌아가기</button>}
    </nav>
    <header className="purchase-card">
      <p className="eyebrow">구매요청 · v{request.version}</p>
      <h2 ref={heading} tabIndex={-1}>구매요청서 · {purchaseStatusLabels[request.status]}</h2>
      <p>{request.purpose || '구매 목적 확인 필요'}</p>
      <p className="hint">생성 {new Date(request.createdAt).toLocaleString('ko-KR')}</p>
    </header>
    {request.status === 'rejected' && <section className="purchase-card" aria-label="반려 결과"><h3>반려 사유</h3><p>{[...request.history].reverse().find(entry => entry.action === 'rejected')?.reason ?? '사유를 확인할 수 없어요.'}</p></section>}
    {request.warnings.length > 0 && <details className="purchase-card"><summary>초안 생성 시 확인 사항</summary><ul>{request.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    <div className="purchase-detail-grid">
      <div className="purchase-card">
        <DraftForm request={request} busy={busy} stale={props.stale} dirty={props.dirty} readOnly={props.finance}
          onDirty={props.onDirty} onSave={props.onSave} onDiscard={props.onDiscard} onSubmit={props.onSubmit} />
        <button disabled={busy} onClick={props.onReload}>요청서 다시 불러오기</button>
        {props.finance && request.status === 'submitted' && <FinanceReview busy={busy} stale={props.stale}
          amountUnknown={analyzeDraft(createDraftValues(request)).total === null} onDirty={props.onDirty} onDecide={props.onDecide} />}
      </div>
      <aside className="purchase-evidence" aria-label="요청서 근거와 이력">
        <details className="purchase-card" open><summary>근거 대화 ({request.sources.length})</summary>
          {request.sources.length ? request.sources.map(source => <blockquote key={source.id}>{source.content}</blockquote>) : <p>연결된 근거 대화가 없어요.</p>}
        </details>
        <details className="purchase-card" open><summary>처리 이력 ({request.history.length})</summary><ul>{request.history.map(entry => <li key={entry.id}>
          v{entry.version} · {({ created: '생성', updated: '수정', discarded: '폐기', submitted: '제출', approved: '승인', rejected: '반려' } as Record<string, string>)[entry.action] ?? entry.action} · {new Date(entry.createdAt).toLocaleString('ko-KR')}
        </li>)}</ul></details>
      </aside>
    </div>
  </article>
}
