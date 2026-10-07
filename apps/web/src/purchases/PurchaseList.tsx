import { useState } from 'react'
import type { PurchaseStatus, PurchaseSummary } from '@vada/contracts'
import { purchaseStatusLabels, purchaseStatusTones } from './purchase-status'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

type Props = { rows: PurchaseSummary[]; finance: boolean; loading: boolean; error: string; disabled: boolean; onSelect: (id: string) => void; hasMore: boolean; onOlder: () => void }
export default function PurchaseList({ rows, finance, loading, error, disabled, onSelect, hasMore, onOlder }: Props) {
  const [status, setStatus] = useState<PurchaseStatus | 'all'>('all')
  const visible = rows.filter(row => status === 'all' || row.status === status)
  const statuses = (Object.keys(purchaseStatusLabels) as PurchaseStatus[]).filter(value => !finance || !['draft', 'discarded'].includes(value))
  return <section className={cn(cardClass, 'flex flex-col gap-3 p-4')} tabIndex={-1} aria-label={finance ? '제출된 요청서' : '내 요청서'} aria-busy={loading}>
    <h3 className="text-sm font-semibold">{finance ? '제출된 요청서' : '내 요청서'}</h3>
    <Label className="flex max-w-xs flex-col gap-1.5">상태 필터<NativeSelect value={status} onChange={event => setStatus(event.target.value as PurchaseStatus | 'all')}>
      <option value="all">전체 상태</option>{statuses.map(value => <option key={value} value={value}>{purchaseStatusLabels[value]}</option>)}
    </NativeSelect></Label>
    {hasMore && <p className="text-xs text-gray-500">불러온 요청서에만 필터가 적용돼요. 이전 요청서를 더 불러올 수 있어요.</p>}
    {loading ? <StateMessage kind="loading">요청서 불러오는 중…</StateMessage> : !rows.length && !error && <StateMessage kind="empty">{finance ? '제출된 요청서가 없어요.' : '아직 내 요청서가 없어요.'}</StateMessage>}
    {!loading && !error && rows.length > 0 && !visible.length && <StateMessage kind="notice">불러온 요청서 중 해당 상태가 없어요.</StateMessage>}
    <ul className="flex flex-col gap-2">{visible.map(row => <li key={row.id}>
      <Button variant="outline" className="w-full flex-wrap justify-start gap-3 p-4 text-left whitespace-normal" data-purchase-id={row.id} disabled={disabled} onClick={() => onSelect(row.id)}>
        <strong className="min-w-0 flex-1 wrap-anywhere max-md:basis-full">{row.purpose || '구매 목적 확인 필요'}</strong>{' '}
        <Badge tone={purchaseStatusTones[row.status]}>{purchaseStatusLabels[row.status]}</Badge>{' '}
        <time className="text-xs font-normal text-gray-400" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('ko-KR')}</time>
      </Button>
    </li>)}</ul>
    {hasMore && <Button variant="outline" className="self-start" disabled={disabled} onClick={onOlder}>이전 요청서</Button>}
  </section>
}
