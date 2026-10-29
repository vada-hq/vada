import { useState } from 'react'
import {
  FeePaymentSearchSchema,
  type FeePaymentMatch,
  type FeePaymentsResponse,
  type FeePaymentPeriod,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { FEE_PAYMENT_SEARCH_INVALID, FEE_PAYMENTS_LOAD_FAILED } from '@/lib/messages'
import type { PolledState } from '@/lib/use-polled-read'
import { requiredText, useFormCheck, withContract } from '@/lib/use-form-check'
import { FeePaymentRemoveDialog } from './FeePaymentRemoveDialog'
import { FeePaymentUploadDialog } from './FeePaymentUploadDialog'
import { useFeePayments } from './useFeePayments'

type Props = {
  councilId: string
  // `fee_payment.manage`(재정부)가 있을 때만 올리기와 빼기를 더한다. 보는 것은 재정부와 회장단이다.
  canManage: boolean
  onForbidden: () => void
}

function Periods({ periods }: { periods: FeePaymentPeriod[] }) {
  if (periods.length === 0) return <StateMessage kind="empty">납부자 명단 없음</StateMessage>
  return (
    <ul aria-label="납부 기간" className="flex flex-col gap-2">
      {periods.map(period => (
        <li key={`${period.paidFrom}~${period.paidUntil}`}>
          <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="text-fg">
              {period.paidFrom} ~ {period.paidUntil}
            </span>
            <span className="text-fg-muted">{period.count}명</span>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function Matches({
  matches,
  canManage,
  onRemove,
}: {
  matches: FeePaymentMatch[]
  canManage: boolean
  onRemove: (payment: FeePaymentMatch) => void
}) {
  if (matches.length === 0)
    return <StateMessage kind="empty">이 학번은 명단에 없어요.</StateMessage>
  return (
    <ul aria-label="찾은 학번" className="flex flex-col gap-2">
      {matches.map(match => (
        <li key={match.id}>
          <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="min-w-0 wrap-anywhere text-fg">
              {match.studentId} · {match.paidFrom} ~ {match.paidUntil}
            </span>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => onRemove(match)}>
                빼기
              </Button>
            )}
          </Card>
        </li>
      ))}
    </ul>
  )
}

// 학번 하나를 찾는다. 학번은 찾을 때만 나가고 목록으로는 나가지 않는다(DEC-62).
function SearchRow({
  applied,
  onSearch,
}: {
  applied: string | undefined
  onSearch: (studentId: string | undefined) => void
}) {
  const [query, setQuery] = useState('')
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() =>
    withContract(
      { studentId: requiredText(query, '학번을') },
      FeePaymentSearchSchema.safeParse({ studentId: query }),
      { studentId: FEE_PAYMENT_SEARCH_INVALID },
    ),
  )
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="학번 찾기"
      className="flex flex-wrap items-start gap-2"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) onSearch(query.trim())
      }}
    >
      <Field label="찾을 학번" required error={fieldErrors.studentId} className="min-w-0 flex-1">
        <Input value={query} inputMode="numeric" onChange={event => setQuery(event.target.value)} />
      </Field>
      {/* 라벨 줄 높이만큼 내려 입력칸과 맞춘다. 문제 글이 생겨도 버튼은 그대로다. */}
      <div className="mt-6 flex gap-2">
        <Button type="submit" variant="outline">
          찾기
        </Button>
        {applied && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setQuery('')
              onSearch(undefined)
            }}
          >
            전체 보기
          </Button>
        )}
      </div>
    </form>
  )
}

// 열린 대화상자: 올리기, 빼기(그 학번)
type Open = { kind: 'upload' } | { kind: 'remove'; payment: FeePaymentMatch } | null

type Handlers = {
  onForbidden: () => void
  onLost: (message: string) => void
}

function FeeDialogs({
  open,
  councilId,
  handlers,
  close,
}: {
  open: Open
  councilId: string
  handlers: Handlers
  close: (changed: boolean) => void
}) {
  if (open?.kind === 'upload')
    return <FeePaymentUploadDialog councilId={councilId} onClose={close} {...handlers} />
  if (open?.kind === 'remove')
    return (
      <FeePaymentRemoveDialog
        councilId={councilId}
        payment={open.payment}
        onDone={() => close(true)}
        onClose={() => close(false)}
        {...handlers}
      />
    )
  return null
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <StateMessage kind="error">{FEE_PAYMENTS_LOAD_FAILED}</StateMessage>
      <Button variant="outline" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}

// 읽는 중·실패는 목록 자리만 바꾼다. 찾기 줄은 늘 남아 있어야 실패해도 전체 보기로 돌아갈 수 있다.
function ListArea({
  state,
  applied,
  canManage,
  onRetry,
  onRemove,
}: {
  state: PolledState<FeePaymentsResponse>
  applied: string | undefined
  canManage: boolean
  onRetry: () => void
  onRemove: (payment: FeePaymentMatch) => void
}) {
  if (state.kind === 'loading')
    return <StateMessage kind="loading">납부자 명단 불러오는 중…</StateMessage>
  if (state.kind === 'failed') return <LoadFailed onRetry={onRetry} />
  return (
    <>
      <Periods periods={state.data.periods} />
      {applied && (
        <Matches matches={state.data.matches} canManage={canManage} onRemove={onRemove} />
      )}
    </>
  )
}

// 납부자 명단 탭: 납부 기간마다 수를 보이고, 학번을 찾아 있는지 본다. 재정부는 붙여 넣어 올리고 잘못 올린 학번을 뺀다.
export function FeePaymentsTab({ councilId, canManage, onForbidden }: Props) {
  const [applied, setApplied] = useState<string | undefined>(undefined)
  const [open, setOpen] = useState<Open>(null)
  const [lost, setLost] = useState<string | null>(null)
  const list = useFeePayments(councilId, applied, onForbidden)
  const { state } = list
  const handlers = {
    onForbidden,
    onLost: (message: string) => {
      setOpen(null)
      setLost(message)
      void list.reload()
    },
  }
  const start = (next: Open) => {
    setLost(null)
    setOpen(next)
  }
  const close = (changed: boolean) => {
    setOpen(null)
    if (changed) void list.reload()
  }
  return (
    <div className="flex flex-col gap-3">
      {lost && <StateMessage kind="error">{lost}</StateMessage>}
      {canManage && (
        <Button className="self-start" onClick={() => start({ kind: 'upload' })}>
          납부자 올리기
        </Button>
      )}
      <SearchRow applied={applied} onSearch={setApplied} />
      <ListArea
        state={state}
        applied={applied}
        canManage={canManage}
        onRetry={() => void list.reload()}
        onRemove={payment => start({ kind: 'remove', payment })}
      />
      <FeeDialogs open={open} councilId={councilId} handlers={handlers} close={close} />
    </div>
  )
}
