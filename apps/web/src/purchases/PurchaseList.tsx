import { useState } from 'react'
import type { PurchaseStatus, PurchaseSummary } from '@vada/contracts'
import { purchaseStatusLabels } from './purchase-status'
import StateMessage from '@/components/StateMessage'

type Props = { rows: PurchaseSummary[]; finance: boolean; loading: boolean; error: string; disabled: boolean; onSelect: (id: string) => void; hasMore: boolean; onOlder: () => void }
export default function PurchaseList({ rows, finance, loading, error, disabled, onSelect, hasMore, onOlder }: Props) {
  const [status, setStatus] = useState<PurchaseStatus | 'all'>('all')
  const visible = rows.filter(row => status === 'all' || row.status === status)
  const statuses = (Object.keys(purchaseStatusLabels) as PurchaseStatus[]).filter(value => !finance || !['draft', 'discarded'].includes(value))
  return <section className="purchase-card" tabIndex={-1} aria-label={finance ? '제출된 요청서' : '내 요청서'} aria-busy={loading}>
    <h3>{finance ? '제출된 요청서' : '내 요청서'}</h3>
    <label className="purchase-filter">상태 필터<select value={status} onChange={event => setStatus(event.target.value as PurchaseStatus | 'all')}>
      <option value="all">전체 상태</option>{statuses.map(value => <option key={value} value={value}>{purchaseStatusLabels[value]}</option>)}
    </select></label>
    {hasMore && <p className="hint">불러온 요청서에만 필터가 적용돼요. 이전 요청서를 더 불러올 수 있어요.</p>}
    {loading ? <StateMessage kind="loading">요청서 불러오는 중…</StateMessage> : !rows.length && !error && <StateMessage kind="empty">{finance ? '제출된 요청서가 없어요.' : '아직 내 요청서가 없어요.'}</StateMessage>}
    {!loading && !error && rows.length > 0 && !visible.length && <StateMessage kind="notice">불러온 요청서 중 해당 상태가 없어요.</StateMessage>}
    <ul className="purchase-list">{visible.map(row => <li key={row.id}>
      <button className="button-secondary" data-purchase-id={row.id} disabled={disabled} onClick={() => onSelect(row.id)}>
        <strong>{row.purpose || '구매 목적 확인 필요'}</strong>{' '}
        <span className="badge">{purchaseStatusLabels[row.status]}</span>{' '}
        <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('ko-KR')}</time>
      </button>
    </li>)}</ul>
    {hasMore && <button disabled={disabled} onClick={onOlder}>이전 요청서</button>}
  </section>
}
