import { useState } from 'react'
import { CreateRegistrationFormSchema, type CreateRegistrationFormRequest, type EventSummary, type FeeAccount, type RegistrationFormView,
  type RegistrationResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { budgetInput } from '../settlement/settlement-view'
import type { RegistrationResult } from './useRegistration'

type Props = {
  open: boolean
  event: EventSummary
  // 있으면 설정 바꾸기, 없으면 새로 만들기다.
  form: RegistrationFormView | null
  // 이미 받은 휴대폰 번호 수. 받기를 끄면 같이 지운다고 알린다.
  phoneCount: number
  // 참가비를 받는 학생회 계좌와 기한이 남은 학생회비 명단. 재정 담당자가 정한다.
  account: FeeAccount | null
  roster: RegistrationResponse['roster']
  onClose: () => void
  onSubmit: (input: CreateRegistrationFormRequest) => Promise<RegistrationResult>
}

// 와이어프레임 EVT-05의 모집 설정과 EVT-02B의 참가비. 질문 만들기·관리자 승인·대기 신청은 넣지 않았다.
export default function RegistrationFormDialog({ open, onClose, ...props }: Props) {
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    {open && <DialogContent><Form key={props.form ? `${props.form.id}:${props.form.version}` : 'new'} onClose={onClose} {...props} /></DialogContent>}
  </Dialog>
}

// 금액 칸은 글 칸이다. "5,000"처럼 쉼표·"원"을 넣어도 읽고, 비우면 0원이다.
const amountOf = (text: string) => budgetInput(text) ?? 0

function Form({ event, form, phoneCount, account, roster, onClose, onSubmit }: Omit<Props, 'open'>) {
  const [opensAt, setOpensAt] = useState(form?.opensAt ?? '')
  // 처음 만들 때는 행사 시작 때 마감한다.
  const [closesAt, setClosesAt] = useState(form?.closesAt ?? event.startsAt ?? '')
  const [capacity, setCapacity] = useState(form?.capacity?.toString() ?? '')
  const [notice, setNotice] = useState(form?.notice ?? '')
  const [collectPhone, setCollectPhone] = useState(form?.collectPhone ?? false)
  const [fee, setFee] = useState((form?.fee ?? 0).toLocaleString('ko-KR'))
  const [memberOn, setMemberOn] = useState(form ? form.memberFee !== null : false)
  const [memberFee, setMemberFee] = useState((form?.memberFee ?? 0).toLocaleString('ko-KR'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const input: CreateRegistrationFormRequest = { opensAt: opensAt || null, closesAt, capacity: capacity.trim() ? Number(capacity) : null,
    notice: notice.trim() ? notice : null, collectPhone, fee: amountOf(fee), memberFee: memberOn ? amountOf(memberFee) : null }
  const end = event.endsAt ?? event.startsAt
  const late = end !== null && closesAt !== '' && closesAt > end
  // 입금을 확인한 신청이 있으면 금액을 바꿀 수 없다(서버도 막는다).
  const locked = (form?.payments.count ?? 0) > 0
  const needsAccount = input.fee > 0 && account === null
  // 명단은 납부자 참가비를 새로 켤 때만 본다. 이미 켠 뒤에 명단 기한이 지나도 다른 설정은 바꿀 수 있다.
  const needsRoster = memberOn && (form?.memberFee ?? null) === null && roster === null
  const memberTooHigh = input.memberFee !== null && Number.isInteger(input.fee) && Number.isInteger(input.memberFee) && input.memberFee >= input.fee
  // 버튼은 서버와 같은 스키마로 켠다. 마감이 행사 끝보다 늦으면 서버도 받지 않는다.
  const valid = !late && !needsAccount && !needsRoster && CreateRegistrationFormSchema.safeParse(input).success
  const dropsPhones = Boolean(form?.collectPhone) && !collectPhone && phoneCount > 0
  async function save() {
    setBusy(true)
    setMessage('')
    const result = await onSubmit(input)
    setBusy(false)
    if (result.ok) onClose()
    else setMessage(result.message)
  }
  return <>
    <DialogHeader>
      <DialogTitle>참가 신청 설정</DialogTitle>
      <DialogDescription>신청 링크를 받은 학생은 로그인 없이 신청해요. 시각은 한국 시각이에요.</DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="flex flex-col gap-1.5">신청 시작(선택)
          <Input type="datetime-local" value={opensAt} onChange={item => setOpensAt(item.target.value)} /></Label>
        <Label className="flex flex-col gap-1.5">신청 마감
          <Input type="datetime-local" value={closesAt} max={end ?? undefined} onChange={item => setClosesAt(item.target.value)} /></Label>
      </div>
      {late && <p className="text-xs text-destructive">신청 마감은 행사가 끝나기 전이어야 해요.</p>}
      {opensAt !== '' && closesAt !== '' && opensAt >= closesAt && <p className="text-xs text-destructive">신청 시작은 마감보다 앞이어야 해요.</p>}
      <Label className="flex flex-col gap-1.5">정원(선택)
        <Input type="number" inputMode="numeric" min={1} value={capacity} onChange={item => setCapacity(item.target.value)} /></Label>
      <section aria-label="참가비" className="flex flex-col gap-2 rounded-md border p-3">
        <Label className="flex flex-col gap-1.5">참가비(원)
          <Input inputMode="numeric" value={fee} disabled={locked} onChange={item => setFee(item.target.value)} /></Label>
        <p className="text-xs text-gray-500">0이면 무료예요.</p>
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input type="checkbox" className="size-4 accent-blue-600" checked={memberOn} disabled={locked}
            onChange={item => setMemberOn(item.target.checked)} />
          학생회비 납부자는 다른 금액
        </Label>
        {memberOn && <Label className="flex flex-col gap-1.5">납부자 참가비(원)
          <Input inputMode="numeric" value={memberFee} disabled={locked} onChange={item => setMemberFee(item.target.value)} /></Label>}
        {memberTooHigh && <p className="text-xs text-destructive">납부자 참가비는 참가비보다 적어야 해요.</p>}
        {input.fee > 0 && account && <p className="flex flex-wrap gap-x-2 text-xs text-gray-600">
          <span className="text-gray-500">받는 계좌</span>
          <span className="wrap-anywhere">{account.bank} {account.accountNumber} ({account.holder})</span></p>}
        {needsAccount && <p className="text-xs text-destructive">
          학생회 계좌가 없어 참가비를 받을 수 없어요. 재정 담당자에게 '참가비 설정'에서 계좌를 넣어 달라고 해 주세요.</p>}
        {needsRoster && <p className="text-xs text-destructive">쓸 수 있는 학생회비 명단이 없어요. 재정 담당자에게 명단을 올려 달라고 해 주세요.</p>}
        {locked && <p className="text-xs text-gray-500">입금을 확인한 신청이 있어 참가비를 바꿀 수 없어요.</p>}
      </section>
      <Label className="flex flex-col gap-1.5">안내 문구(선택)
        <Textarea rows={3} value={notice} placeholder="대상, 준비물, 문의처" onChange={item => setNotice(item.target.value)} /></Label>
      <Label className="flex items-center gap-2 text-sm font-normal">
        <input type="checkbox" className="size-4 accent-blue-600" checked={collectPhone} onChange={item => setCollectPhone(item.target.checked)} />
        휴대폰 번호도 받기
      </Label>
      {dropsPhones && <Alert tone="danger">끄면 이미 받은 휴대폰 번호 {phoneCount}개도 지워요.</Alert>}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </div>
    <DialogFooter>
      <Button variant="outline" disabled={busy} onClick={onClose}>닫기</Button>
      <Button variant={dropsPhones ? 'destructive' : 'default'} disabled={busy || !valid} onClick={() => void save()}>
        {form ? dropsPhones ? '번호 지우고 저장' : '저장' : '만들기'}</Button>
    </DialogFooter>
  </>
}
