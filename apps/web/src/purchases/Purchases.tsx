import { useEffect, useRef, useState } from 'react'
import { usePurchases } from './usePurchases'
import PurchaseList from './PurchaseList'
import PurchaseDetail from './PurchaseDetail'
import LinkDialog from './LinkDialog'
import StateMessage from '@/components/StateMessage'
import './Purchases.css'

type Props = {
  organizationId: string; eventId: string; finance?: boolean
  dialogOpen?: boolean; onDialogClose?: () => void; onDetailOpen?: () => void
  onReturnToChat?: () => void; onLeaveRiskChange?: (risk: boolean) => void
}
export default function Purchases(props: Props) {
  return <Panel key={JSON.stringify([props.organizationId, props.eventId, props.finance])} {...props} />
}

function Panel({ organizationId, eventId, finance = false, dialogOpen = false, onDialogClose, onDetailOpen, onReturnToChat, onLeaveRiskChange }: Props) {
  const data = usePurchases(organizationId, eventId, finance)
  const [links, setLinks] = useState('')
  // 응답 revision에 편집 상태를 연결한다. 지연된 effect가 새 입력을 깨끗한 상태로 덮지 않는다.
  const [dirtyRevision, setDirtyRevision] = useState<number | null>(null)
  const dirty = dirtyRevision === data.revision
  function setDirty(value: boolean) { setDirtyRevision(value ? data.revision : null) }
  const [localDialog, setLocalDialog] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const listContainer = useRef<HTMLDivElement>(null)
  const restoreListFocus = useRef(false)
  const modalOpen = !finance && (dialogOpen || localDialog)
  useEffect(() => {
    if (detailOpen || !restoreListFocus.current) return
    restoreListFocus.current = false
    const container = listContainer.current
    if (!container || container.closest('[hidden]')) return
    const row = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-purchase-id]'))
      .find(button => button.dataset.purchaseId === data.selected?.id)
    const target = row ?? container.querySelector<HTMLElement>('section')
    target?.focus()
  }, [detailOpen, data.selected?.id])
  useEffect(() => { onLeaveRiskChange?.(dirty || data.mutating || Boolean(links.trim())) }, [dirty, data.mutating, links, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange?.(false), [onLeaveRiskChange])
  function leave() { return !dirty || window.confirm('저장하지 않은 수정을 버릴까요?') }
  function closeDialog() { if (!data.mutating) { setLocalDialog(false); onDialogClose?.() } }
  async function select(id: string) {
    if (!leave()) return
    if (await data.select(id)) { setDetailOpen(true); onDetailOpen?.() }
  }
  async function create(urls: string[]) {
    if (!leave()) return
    if (await data.create(urls)) {
      setLinks(''); setLocalDialog(false); onDialogClose?.()
      setDetailOpen(true); onDetailOpen?.()
    }
  }
  return <section className="purchases-panel" aria-label="구매요청서">
    <div className="purchase-toolbar">
      <h2>{finance ? '재정부 · 제출 요청 조회' : '내 구매요청'}</h2>
      <div className="purchase-actions">
        {!finance && <button disabled={data.busy || data.denied} onClick={() => setLocalDialog(true)}>끼룩이 · 초안 만들기</button>}
        <button className="button-quiet" disabled={data.busy || data.denied} onClick={data.refresh}>요청 목록 새로고침</button>
      </div>
    </div>
    {data.error && !modalOpen && <StateMessage kind="error">{data.error}</StateMessage>}
    {data.notice && <StateMessage kind="notice">{data.notice}</StateMessage>}
    {!finance && <LinkDialog open={modalOpen} links={links} onLinksChange={setLinks} busy={data.mutating}
      disabled={data.busy || data.loading || data.denied} error={data.error} onClose={closeDialog} onCreate={urls => { void create(urls) }} />}
    {detailOpen && data.selected ? <PurchaseDetail key={`${data.selected.id}:${data.revision}`}
      request={data.selected} busy={data.busy} stale={data.stale} dirty={dirty} finance={finance} onDirty={setDirty}
      onBack={() => { if (leave()) { restoreListFocus.current = true; setDirty(false); setDetailOpen(false) } }} onReturnToChat={onReturnToChat}
      onSubmit={() => { if (!dirty && window.confirm('저장된 요청서를 제출할까요? 제출 후에는 수정하거나 폐기할 수 없어요.')) data.submit() }}
      onSave={data.save} onDiscard={() => { if (window.confirm('이 초안을 폐기할까요? 폐기한 초안은 수정할 수 없어요.')) data.discard() }}
      onDecide={data.decide} onReload={() => { void select(data.selected!.id) }} />
      : null}
    <div ref={listContainer} hidden={detailOpen && Boolean(data.selected)}>
      <PurchaseList rows={data.rows} loading={data.loading} error={data.error} finance={finance}
        disabled={data.busy || data.denied} onSelect={id => { void select(id) }} hasMore={Boolean(data.cursor)} onOlder={data.older} />
    </div>
  </section>
}
