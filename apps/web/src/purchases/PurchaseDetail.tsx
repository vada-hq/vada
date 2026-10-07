import { useEffect, useRef } from 'react'
import type { PurchaseDetail as PurchaseRequest, UpdatePurchaseDraftRequest } from '@vada/contracts'
import DraftForm from './DraftForm'
import FinanceReview from './FinanceReview'
import DeliveryPanel from '../deliveries/DeliveryPanel'
import { analyzeDraft, createDraftValues } from './draft-form-model'
import { purchaseStatusLabels } from './purchase-status'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  return <article className="flex flex-col gap-4">
    <nav className="flex flex-wrap gap-2" aria-label="요청서 이동">
      <Button variant="ghost" size="sm" disabled={busy} onClick={onBack}>요청 목록으로</Button>
      {onReturnToChat && <Button variant="ghost" size="sm" disabled={busy} onClick={onReturnToChat}>대화로 돌아가기</Button>}
    </nav>
    <header className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
      <p className="text-xs text-gray-500">구매요청 · v{request.version}</p>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">구매요청서 · {purchaseStatusLabels[request.status]}</h2>
      <p className="text-sm wrap-anywhere text-gray-700">{request.purpose || '구매 목적 확인 필요'}</p>
      <p className="text-xs text-gray-500">생성 {new Date(request.createdAt).toLocaleString('ko-KR')}</p>
    </header>
    {request.status === 'rejected' && <section className={cn(cardClass, 'flex flex-col gap-1 p-4')} aria-label="반려 결과"><h3 className="text-sm font-semibold">반려 사유</h3><p className="text-sm wrap-anywhere whitespace-pre-wrap">{[...request.history].reverse().find(entry => entry.action === 'rejected')?.reason ?? '사유를 확인할 수 없어요.'}</p></section>}
    {request.warnings.length > 0 && <details className={cn(cardClass, 'p-4')}><summary className="cursor-pointer text-sm font-medium">초안 생성 시 확인 사항</summary><ul className="mt-2 list-disc pl-5 text-sm wrap-anywhere">{request.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    {request.status === 'approved' && <DeliveryPanel request={request} finance={props.finance} />}
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className={cn(cardClass, 'flex min-w-0 flex-col gap-3 p-4 lg:col-span-2')}>
        <DraftForm request={request} busy={busy} stale={props.stale} dirty={props.dirty} readOnly={props.finance}
          onDirty={props.onDirty} onSave={props.onSave} onDiscard={props.onDiscard} onSubmit={props.onSubmit} />
        <Button variant="outline" className="self-start" disabled={busy} onClick={props.onReload}>요청서 다시 불러오기</Button>
        {props.finance && request.status === 'submitted' && <FinanceReview busy={busy} stale={props.stale}
          amountUnknown={analyzeDraft(createDraftValues(request)).total === null} onDirty={props.onDirty} onDecide={props.onDecide} />}
      </div>
      <aside className="flex min-w-0 flex-col gap-4" aria-label="요청서 근거와 이력">
        <details className={cn(cardClass, 'p-4')} open><summary className="cursor-pointer text-sm font-medium">근거 대화 ({request.sources.length})</summary>
          {request.sources.length ? request.sources.map(source => <blockquote key={source.id} className="mt-2 border-l-4 border-gray-200 pl-3 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700">{source.content}</blockquote>) : <p className="mt-2 text-sm text-gray-500">연결된 근거 대화가 없어요.</p>}
        </details>
        <details className={cn(cardClass, 'p-4')} open><summary className="cursor-pointer text-sm font-medium">처리 이력 ({request.history.length})</summary><ul className="mt-2 flex flex-col gap-1 text-xs text-gray-600">{request.history.map(entry => <li key={entry.id}>
          v{entry.version} · {({ created: '생성', updated: '수정', discarded: '폐기', submitted: '제출', approved: '승인', rejected: '반려' } as Record<string, string>)[entry.action] ?? entry.action} · {new Date(entry.createdAt).toLocaleString('ko-KR')}
        </li>)}</ul></details>
      </aside>
    </div>
  </article>
}
