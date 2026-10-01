import { useId, useState, type FormEvent } from 'react'
import type { DeliveryLookupRequest, DeliveryLookupResponse } from '@vada/contracts'
import { deliveryStatusLabels, validTrackingNumber } from './delivery-status'

type Props = {
  items: { id: string; name: string; shipped: boolean }[]
  carriers: { id: string; name: string }[]
  busy: boolean
  onSearchCarriers: (search: string) => void
  onLookup: (input: DeliveryLookupRequest) => Promise<DeliveryLookupResponse | null>
  onRegister: (input: DeliveryLookupRequest, itemIds: string[]) => Promise<boolean>
}

// 택배사를 추정하지 않는다. 조회 결과를 확인한 입력만 등록할 수 있다.
export default function ShipmentForm({ items, carriers, busy, onSearchCarriers, onLookup, onRegister }: Props) {
  const [search, setSearch] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [number, setNumber] = useState('')
  const [selected, setSelected] = useState(() => items.filter(item => !item.shipped).map(item => item.id))
  const [result, setResult] = useState<DeliveryLookupResponse | null>(null)
  const searchId = useId(), carrierFieldId = useId(), numberId = useId()
  const trackingNumber = number.trim()
  const chosen = carriers.some(carrier => carrier.id === carrierId) ? carrierId : ''
  const ready = Boolean(chosen) && validTrackingNumber(trackingNumber) && selected.length > 0
  const input = { carrierId: chosen, trackingNumber }

  async function lookup(event: FormEvent) {
    event.preventDefault()
    if (ready && !busy) setResult(await onLookup(input))
  }
  return <form className="shipment-form" aria-label="송장 등록" onSubmit={event => { void lookup(event) }}>
    <h4>송장 등록</h4>
    <p className="hint">택배사를 직접 고르고 송장번호를 입력해 주세요. 조회 결과를 확인한 뒤 등록할 수 있어요.</p>
    <label htmlFor={searchId}>택배사 이름 검색</label>
    <div className="shipment-search">
      <input id={searchId} value={search} maxLength={100} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder="목록에 없으면 이름으로 검색해 주세요." />
      <button type="button" className="button-secondary" disabled={busy} onClick={() => onSearchCarriers(search.trim())}>택배사 검색</button>
    </div>
    <label htmlFor={carrierFieldId}>택배사</label>
    <select id={carrierFieldId} value={chosen} disabled={busy} onChange={event => { setCarrierId(event.target.value); setResult(null) }}>
      <option value="">택배사를 선택해 주세요</option>
      {carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
    </select>
    <label htmlFor={numberId}>송장번호</label>
    <input id={numberId} value={number} maxLength={110} disabled={busy} inputMode="text" autoComplete="off"
      onChange={event => { setNumber(event.target.value); setResult(null) }} />
    {trackingNumber && !validTrackingNumber(trackingNumber) && <p className="hint">송장번호는 영문·숫자·하이픈만 입력할 수 있어요.</p>}
    <fieldset>
      <legend>이 송장으로 받는 품목</legend>
      {items.map(item => <label key={item.id} className="shipment-item">
        <input type="checkbox" checked={selected.includes(item.id)} disabled={busy} onChange={event => {
          setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id)); setResult(null)
        }} />{item.name}
      </label>)}
    </fieldset>
    {result && <p className="shipment-result" aria-live="polite">
      조회 결과: {deliveryStatusLabels[result.status] ?? deliveryStatusLabels.unknown}
      {result.lastEventAt ? ` · 마지막 배송 기록 ${new Date(result.lastEventAt).toLocaleString('ko-KR')}` : ' · 배송 기록 없음'}
      <br />선택한 품목의 송장이 맞는지 확인한 뒤 등록해 주세요.
    </p>}
    <div className="purchase-actions">
      <button type="submit" className="button-secondary" disabled={busy || !ready}>송장 조회</button>
      <button type="button" disabled={busy || !ready || !result} onClick={() => {
        // 품목 순서와 무관하게 같은 등록 의도는 같은 입력이 되도록 정렬한다.
        void onRegister(input, [...selected].sort())
      }}>이 송장으로 등록</button>
    </div>
  </form>
}
