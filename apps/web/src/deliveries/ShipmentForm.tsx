import { useId, useState, type FormEvent } from 'react'
import type { DeliveryLookupRequest, DeliveryLookupResponse } from '@vada/contracts'
import { deliveryStatusLabels, validTrackingNumber } from './delivery-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

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
  return <form className="flex flex-col gap-3 border-t pt-4" aria-label="송장 등록" onSubmit={event => { void lookup(event) }}>
    <h4 className="text-sm font-semibold">송장 등록</h4>
    <p className="text-xs text-gray-500">택배사를 직접 고르고 송장번호를 입력해 주세요. 조회 결과를 확인한 뒤 등록할 수 있어요.</p>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={searchId}>택배사 이름 검색</Label>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input id={searchId} value={search} maxLength={100} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder="목록에 없으면 이름으로 검색해 주세요." />
        <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={() => onSearchCarriers(search.trim())}>택배사 검색</Button>
      </div>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={carrierFieldId}>택배사</Label>
      <NativeSelect id={carrierFieldId} value={chosen} disabled={busy} onChange={event => { setCarrierId(event.target.value); setResult(null) }}>
        <option value="">택배사를 선택해 주세요</option>
        {carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
      </NativeSelect>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={numberId}>송장번호</Label>
      <Input id={numberId} value={number} maxLength={110} disabled={busy} inputMode="text" autoComplete="off"
        onChange={event => { setNumber(event.target.value); setResult(null) }} />
    </div>
    {trackingNumber && !validTrackingNumber(trackingNumber) && <p className="text-xs text-gray-500">송장번호는 영문·숫자·하이픈만 입력할 수 있어요.</p>}
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-gray-700">이 송장으로 받는 품목</legend>
      {items.map(item => <label key={item.id} className="flex items-center gap-2 text-sm wrap-anywhere">
        <input type="checkbox" className="size-4 shrink-0 accent-blue-600" checked={selected.includes(item.id)} disabled={busy} onChange={event => {
          setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id)); setResult(null)
        }} />{item.name}
      </label>)}
    </fieldset>
    {result && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-700" aria-live="polite">
      조회 결과: {deliveryStatusLabels[result.status] ?? deliveryStatusLabels.unknown}
      {result.lastEventAt ? ` · 마지막 배송 기록 ${new Date(result.lastEventAt).toLocaleString('ko-KR')}` : ' · 배송 기록 없음'}
      <br />선택한 품목의 송장이 맞는지 확인한 뒤 등록해 주세요.
    </p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="outline" disabled={busy || !ready}>송장 조회</Button>
      <Button type="button" disabled={busy || !ready || !result} onClick={() => {
        // 품목 순서와 무관하게 같은 등록 의도는 같은 입력이 되도록 정렬한다.
        void onRegister(input, [...selected].sort())
      }}>이 송장으로 등록</Button>
    </div>
  </form>
}
