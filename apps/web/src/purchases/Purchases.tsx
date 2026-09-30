import { useEffect, useId, useState } from 'react'
import type { PurchaseDetail, UpdatePurchaseDraftRequest } from '@vada/contracts'
import { usePurchases } from './usePurchases'

type Props = { organizationId: string; eventId: string; finance?: boolean }
export default function Purchases(props: Props) {
  return <Panel key={JSON.stringify([props.organizationId, props.eventId, props.finance])} {...props} />
}
const states = { draft: '검토 대기', discarded: '폐기', submitted: '접수', approved: '승인', rejected: '반려' }

function Panel({ organizationId, eventId, finance = false }: Props) {
  const data = usePurchases(organizationId, eventId, finance)
  const [links, setLinks] = useState('')
  const [dirty, setDirty] = useState(false)
  const inputId = useId()
  useEffect(() => { setDirty(false) }, [data.revision])
  useEffect(() => { if (data.notice === '초안을 만들었어요. 내용을 확인해 주세요.') setLinks('') }, [data.notice])
  const urls = links.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  function leave() { return !dirty || window.confirm('저장하지 않은 수정을 버릴까요?') }
  function select(id: string) { if (leave()) data.select(id) }
  return <section className="purchases-panel" aria-label="구매요청서">
    <h3>{finance ? '재정부 · 제출 요청 조회' : '끼룩이 · 구매요청서'}</h3>
    <p className="hint">{finance ? '현재 행사의 제출된 요청서를 확인하고 승인·반려해요. 요청 내용은 수정할 수 없어요.' : '링크와 현재 행사방의 최근 대화를 외부 AI로 처리해 초안을 만들어요. 제출 전에는 작성자만 볼 수 있어요.'}</p>
    {data.error && <p role="alert">{data.error}</p>}
    {data.notice && <p role="status">{data.notice}</p>}
    {!finance && <form aria-label="구매 초안 생성" onSubmit={event => {
      event.preventDefault()
      if (data.busy || data.denied || !urls.length || urls.length > 5 || !leave()) return
      data.create(urls)
    }}>
      <label htmlFor={inputId}>쿠팡 상품 링크</label>
      <textarea id={inputId} value={links} rows={3} disabled={data.busy || data.denied} onChange={event => setLinks(event.target.value)} placeholder="주소창의 상품 링크를 한 줄에 하나씩, 최대 5개" />
      <button disabled={data.busy || data.loading || data.denied || !urls.length || urls.length > 5}>초안 만들기</button>
      {data.busy && <p role="status">처리 중… 생성은 최대 약 75초 걸릴 수 있어요. 행사 이동 후에도 서버에서 완료될 수 있어요.</p>}
    </form>}
    <h4>{finance ? '제출된 요청서' : '내 요청서'}</h4>
    {data.loading ? <p role="status">요청서 불러오는 중…</p> : !data.rows.length && !data.error && <p>{finance ? '제출된 요청서가 없어요.' : '아직 내 요청서가 없어요.'}</p>}
    <ul className="purchase-list">{data.rows.map(row => <li key={row.id}>
      <button disabled={data.busy || data.denied} aria-pressed={data.selected?.id === row.id} onClick={() => select(row.id)}>
        {row.purpose || '구매 목적 확인 필요'} · {states[row.status]} · {new Date(row.createdAt).toLocaleString('ko-KR')}
      </button>
    </li>)}</ul>
    <button disabled={data.busy || data.denied} onClick={data.refresh}>요청 목록 새로고침</button>
    {data.cursor && <button disabled={data.busy || data.denied} onClick={data.older}>이전 요청서</button>}
    {data.selected && <DraftEditor key={`${data.selected.id}:${data.revision}`}
      request={data.selected} busy={data.busy} stale={data.stale} dirty={dirty} finance={finance} onDirty={setDirty}
      onSubmit={() => { if (!dirty && window.confirm('저장된 요청서를 제출할까요? 제출 후에는 수정하거나 폐기할 수 없어요.')) data.submit() }}
      onSave={data.save} onDiscard={() => { if (window.confirm('이 초안을 폐기할까요? 폐기한 초안은 수정할 수 없어요.')) data.discard() }}
      onDecide={data.decide}
      onReload={() => select(data.selected!.id)} />}
  </section>
}

type EditorProps = {
  request: PurchaseDetail; busy: boolean; stale: boolean; dirty: boolean; finance: boolean
  onDirty: (value: boolean) => void
  onSave: (input: UpdatePurchaseDraftRequest) => void
  onDiscard: () => void; onReload: () => void; onSubmit: () => void
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void
}
function DraftEditor({ request, busy, stale, dirty, finance, onDirty, onSave, onDiscard, onReload, onSubmit, onDecide }: EditorProps) {
  const [reason, setReason] = useState('')
  const [purpose, setPurpose] = useState(request.purpose ?? '')
  const [neededBy, setNeededBy] = useState(request.neededBy ?? '')
  const [shipping, setShipping] = useState(request.estimatedShippingCost?.toString() ?? '')
  const [items, setItems] = useState(() => request.items.map(item => ({ ...item, productName: item.productName ?? '',
    selectedOption: item.selectedOption ?? '', packagingUnit: item.packagingUnit ?? '',
    quantity: item.quantity?.toString() ?? '', estimatedUnitPrice: item.estimatedUnitPrice?.toString() ?? '' })))
  const prefix = useId()
  const readonly = finance || request.status !== 'draft'
  const toNumber = (value: string) => value.trim() === '' ? null : Number(value)
  const text = (value: string) => value.trim() || null
  const invalid = items.some(item => [item.quantity, item.estimatedUnitPrice].some((value, index) => value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < (index ? 0 : 1) || Number(value) > 2147483647))) || (shipping !== '' && (!Number.isSafeInteger(Number(shipping)) || Number(shipping) < 0 || Number(shipping) > 2147483647))
  const missing = [
    ...(!purpose.trim() ? ['구매 목적'] : []), ...(!neededBy ? ['필요한 날짜'] : []),
    ...(!items.length ? ['구매 품목'] : []),
    ...items.flatMap((item, index) => [
      ...(!item.productName.trim() ? [`물품 ${index + 1} 상품명`] : []),
      ...(!item.productUrl ? [`물품 ${index + 1} 상품 링크`] : []),
      ...(!item.quantity || Number(item.quantity) < 1 ? [`물품 ${index + 1} 주문 수량`] : []),
      ...(item.optionRequired === null ? [`물품 ${index + 1} 옵션 필요 여부`] : []),
      ...(item.optionRequired === true && !item.selectedOption.trim() ? [`물품 ${index + 1} 선택 옵션`] : []),
    ]),
  ]
  let total: number | null = toNumber(shipping)
  if (items.some(item => item.quantity === '' || item.estimatedUnitPrice === '') || invalid) total = null
  else if (total !== null) { total += items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.estimatedUnitPrice), 0); if (!Number.isSafeInteger(total)) total = null }
  function changeItem(index: number, key: string, value: string | boolean | null) {
    setItems(previous => previous.map((item, i) => i === index ? { ...item, [key]: value } : item)); onDirty(true)
  }
  return <section className="draft-editor" aria-label="초안 상세">
    <h4>구매요청서 · {states[request.status]}</h4>
    {request.status === 'rejected' && <section aria-label="반려 결과"><h5>반려 사유</h5><p>{[...request.history].reverse().find(entry => entry.action === 'rejected')?.reason ?? '사유를 확인할 수 없어요.'}</p></section>}
    {request.warnings.length > 0 && <details><summary>초안 생성 시 확인 사항</summary><ul>{request.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    <form aria-label="초안 수정" onSubmit={event => {
      event.preventDefault()
      if (busy || readonly || stale || invalid) return
      onSave({ version: request.version, purpose: text(purpose), neededBy: neededBy || null, estimatedShippingCost: toNumber(shipping),
        items: items.map(item => ({ id: item.id, productName: text(item.productName), selectedOption: text(item.selectedOption),
          optionRequired: item.optionRequired, quantity: toNumber(item.quantity), packagingUnit: text(item.packagingUnit), estimatedUnitPrice: toNumber(item.estimatedUnitPrice) })) })
    }}>
      <fieldset disabled={busy || readonly}>
        <label htmlFor={`${prefix}-purpose`}>구매 목적</label>
        <textarea id={`${prefix}-purpose`} value={purpose} onChange={event => { setPurpose(event.target.value); onDirty(true) }} placeholder="확인 필요" />
        <label htmlFor={`${prefix}-date`}>필요한 날짜</label>
        <input id={`${prefix}-date`} type="date" value={neededBy} onChange={event => { setNeededBy(event.target.value); onDirty(true) }} />
        {items.map((item, index) => <fieldset key={item.id} className="purchase-item"><legend>물품 {index + 1}</legend>
          <a href={item.productUrl} target="_blank" rel="noopener noreferrer">상품 링크 열기</a>
          {(['productName', 'selectedOption', 'packagingUnit', 'quantity', 'estimatedUnitPrice'] as const).map((key, field) => <label key={key}>
            {['상품명', '선택 옵션', '포장 단위', '주문 수량', '예상 단가 (원)'][field]}
            <input value={item[key]} type={field >= 3 ? 'number' : 'text'} min={key === 'quantity' ? 1 : 0} step={1} max={field >= 3 ? 2147483647 : undefined}
              placeholder="확인 필요" onChange={event => changeItem(index, key, event.target.value)} />
          </label>)}
          <label>옵션 선택 필요 여부<select value={item.optionRequired === null ? 'unknown' : item.optionRequired ? 'yes' : 'no'}
            onChange={event => changeItem(index, 'optionRequired', event.target.value === 'unknown' ? null : event.target.value === 'yes')}>
            <option value="unknown">확인 필요</option><option value="yes">옵션 선택 필요</option><option value="no">옵션 없음</option>
          </select></label>
          {!item.selectedOption && item.optionRequired !== false && <p className="hint">선택 옵션을 상품 링크에서 확인해 주세요.</p>}
          <p className="hint">포장 단위와 주문 수량은 달라요. 40개입 2묶음이면 주문 수량은 2예요.</p>
        </fieldset>)}
        <label htmlFor={`${prefix}-shipping`}>예상 배송비 (원)</label>
        <input id={`${prefix}-shipping`} type="number" min={0} step={1} max={2147483647} value={shipping} placeholder="확인 필요" onChange={event => { setShipping(event.target.value); onDirty(true) }} />
      </fieldset>
      <p>예상 합계: {total === null ? '확인 필요' : `${total.toLocaleString('ko-KR')}원`}</p>
      <p className="hint">비어 있는 값은 미확인으로 저장해요. 예상 금액은 실제 결제 금액이 아니에요.</p>
      {!readonly && <><button disabled={busy || stale || invalid}>초안 저장</button><button type="button" className="danger" disabled={busy || stale} onClick={onDiscard}>초안 폐기</button></>}
    </form>
    {!readonly && <>
      {missing.length > 0 && <p>제출 전 확인: {missing.join(', ')}</p>}
      {dirty && <p>수정한 내용을 먼저 저장해 주세요.</p>}
      <p className="hint">금액이 미확인이어도 제출할 수 있어요. 제출 후에는 수정·폐기가 불가능해요.</p>
      <button disabled={busy || stale || dirty || invalid || missing.length > 0} onClick={onSubmit}>요청서 제출</button>
    </>}
    <button disabled={busy} onClick={onReload}>요청서 다시 불러오기</button>
    {finance && request.status === 'submitted' && <section aria-label="재정부 처리">
      {total === null && <p className="hint">금액이 미확인입니다. 승인 전 상품 가격과 배송비를 별도로 확인해 주세요.</p>}
      <label htmlFor={`${prefix}-reason`}>반려 사유</label>
      <textarea id={`${prefix}-reason`} value={reason} disabled={busy || stale} maxLength={2000}
        onChange={event => { setReason(event.target.value); onDirty(true) }} placeholder="반려할 경우 사유를 입력해 주세요." />
      <button disabled={busy || stale} onClick={() => {
        if (window.confirm(`${total === null ? '금액이 미확인입니다. 별도로 확인했나요?\n' : ''}이 요청을 승인할까요? 처리 후에는 변경할 수 없어요.`)) onDecide('approved', '')
      }}>요청 승인</button>
      <button className="danger" disabled={busy || stale || !reason.trim() || [...reason].length > 2000} onClick={() => {
        if (window.confirm('입력한 사유로 반려할까요? 처리 후에는 변경할 수 없어요.')) onDecide('rejected', reason)
      }}>요청 반려</button>
    </section>}
    <details><summary>근거 대화 ({request.sources.length})</summary>{request.sources.length ? request.sources.map(source => <blockquote key={source.id}>{source.content}</blockquote>) : <p>연결된 근거 대화가 없어요.</p>}</details>
    <details><summary>처리 이력 ({request.history.length})</summary><ul>{request.history.map(entry => <li key={entry.id}>v{entry.version} · {({ created: '생성', updated: '수정', discarded: '폐기', submitted: '제출', approved: '승인', rejected: '반려' } as Record<string, string>)[entry.action] ?? entry.action} · {new Date(entry.createdAt).toLocaleString('ko-KR')}</li>)}</ul></details>
  </section>
}
