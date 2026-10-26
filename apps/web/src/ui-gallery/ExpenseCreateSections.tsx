import { useState } from 'react'
import type { PurchaseLineItem } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { ExpenseAmountConfirm } from '@/finance/ExpenseAmountConfirm'
import { ModeToggle, NameFields, PaymentFields } from '@/finance/ExpenseFields'
import { ExpensePaymentItems } from '@/finance/ExpenseRequestFields'
import { ExpensePayerFields } from '@/finance/ExpensePayerFields'
import { emptyExpense, toggleLine, type ExpenseValues } from '@/finance/expense-form'
import { wonLabel } from '@/finance/purchase-view'
import { Section } from './GallerySection'

const TODAY = '2026-10-26'
const items: PurchaseLineItem[] = [
  {
    id: 'i1',
    name: '현수막 제작',
    quantity: 1,
    link: 'https://print.example.com/banner',
    options: null,
    amount: 50000,
    budgetItem: null,
    status: 'approved',
    paid: false,
    payable: true,
    actions: [],
  },
]
const initial: ExpenseValues = {
  ...toggleLine(emptyExpense(TODAY), items[0]!),
  eventId: 'ev',
  eventLocked: true,
  accountId: 'a1',
  requestId: 'r1',
  description: '가을 축제 홍보물',
  vendor: 'print.example.com',
}
const noop = () => {}

// 실제 폼의 공통 칸과 품목 줄을 API 없이 그려 데스크톱·휴대폰 폭에서 확인한다.
function ExpensePreview({ phone }: { phone: boolean }) {
  const [values, setValues] = useState(initial)
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const errors = tried && values.method === '' ? { method: '결제 수단을 골라 주세요' } : {}
  const shared = { values, disabled: false, errors, onChange: setValues }
  return (
    <div
      className={`max-w-full rounded-lg border bg-background p-6 ${phone ? 'w-89.5 [&_input]:text-base [&_select]:text-base' : 'w-128'}`}
    >
      <h3 className="mb-6 text-base font-semibold">지출 적기</h3>
      <form
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          setTried(true)
        }}
      >
        <ModeToggle mode="request" disabled={false} onMode={noop} />
        <NameFields {...shared} />
        <ChoiceSelect
          label="결제할 요청"
          required
          choices={[{ id: 'r1', label: '가을 축제 홍보물' }]}
          value="r1"
          disabled={false}
          onChange={noop}
        />
        <ExpensePaymentItems {...shared} items={items} />
        <p className="text-sm text-gray-700">
          합계 {wonLabel(Number(values.lines[0]?.amount ?? 0))}
        </p>
        <ChoiceSelect
          label="행사"
          optional
          choices={[{ id: 'ev', label: '가을 축제' }]}
          value="ev"
          disabled
          onChange={noop}
        />
        <PaymentFields {...shared} today={TODAY} />
        <ChoiceSelect
          label="계좌"
          optional
          choices={[{ id: 'a1', label: '학생회비 통장 (국민은행)' }]}
          value="a1"
          disabled={false}
          onChange={noop}
        />
        <ExpensePayerFields {...shared} team={{ members: [], departments: [] }} memberId="m1" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline">
            닫기
          </Button>
          <Button type="submit">적기</Button>
        </div>
      </form>
      <Button className="mt-4" variant="outline" onClick={() => setConfirming(true)}>
        금액 확인 창 열기
      </Button>
      {confirming && (
        <ExpenseAmountConfirm
          busy={false}
          error={null}
          onClose={() => setConfirming(false)}
          onConfirm={() => setConfirming(false)}
        />
      )}
    </div>
  )
}

export function ExpenseCreateSection() {
  return (
    <>
      <Section title="지출 적기 · 1280">
        <ExpensePreview phone={false} />
      </Section>
      <Section title="지출 적기 · 390">
        <ExpensePreview phone />
      </Section>
    </>
  )
}
