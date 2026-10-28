import type { ReactNode } from 'react'
import { closingLineLabel, type Closing, type ClosingLine } from '@vada/contracts'
import { Card } from '@/components/ui/card'
import { Fact } from '@/components/Fact'
import { SOURCE_LABEL } from './income-view'
import { signedWon } from './closing-view'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0 text-gray-700 wrap-anywhere">{label}</span>
      <span className="whitespace-nowrap text-gray-900">{value}</span>
    </li>
  )
}

// 예산 항목 한 줄: 이름과 결산, 그 아래 예산과 차이(지출은 집행률도).
function LineRow({ line, label = line.purpose }: { line: ClosingLine; label?: string }) {
  return (
    <li className="flex flex-col gap-0.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-gray-700 break-keep wrap-anywhere">{label}</span>
        <span className="text-right whitespace-nowrap text-gray-900 tabular-nums">
          {signedWon(line.actual)}
        </span>
      </div>
      <span className="text-xs text-gray-500">
        예산 {signedWon(line.budget)} · 차이 {signedWon(line.difference)}
        {line.rate !== null && ` · ${line.rate}%`}
      </span>
    </li>
  )
}

// 한 줄이 없으면(0원) 줄이지 않고 보이는 것만 적는다.
function ExtraRow({ label, amount }: { label: string; amount: number }) {
  return amount === 0 ? null : <Row label={label} value={signedWon(amount)} />
}

export function ClosingNumbers({ closing }: { closing: Closing }) {
  return (
    <Section title="요약">
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="전기 이월금">{signedWon(closing.income.carryover)}</Fact>
        <Fact label="수입 합">{signedWon(closing.income.total)}</Fact>
        <Fact label="지출 합">{signedWon(closing.expense.total)}</Fact>
        <Fact label="남은 돈">{signedWon(closing.remaining)}</Fact>
      </dl>
    </Section>
  )
}

export function ClosingIncomeSection({ closing }: { closing: Closing }) {
  const { income } = closing
  return (
    <Section title="수입">
      <ul className="flex flex-col gap-2">
        {income.bySource.map(row => (
          <Row
            key={row.source}
            label={`${SOURCE_LABEL[row.source]} ${row.count}건`}
            value={signedWon(row.amount)}
          />
        ))}
      </ul>
      {(income.items.length > 0 || income.noItem !== 0) && (
        <ul className="flex flex-col gap-2 border-t pt-3">
          {income.items.map(line => (
            <LineRow key={line.id} line={line} />
          ))}
          <ExtraRow label="수입 항목 없음" amount={income.noItem} />
        </ul>
      )}
    </Section>
  )
}

export function ClosingExpenseSection({ closing }: { closing: Closing }) {
  const { expense } = closing
  return (
    <Section title="지출">
      <ul className="flex flex-col gap-2">
        {expense.items.map(line => (
          <LineRow key={line.id} line={line} label={closingLineLabel(line)} />
        ))}
        <ExtraRow label="예산 항목 없음" amount={expense.noItem} />
        <ExtraRow label="다른 기간 항목" amount={expense.otherPeriod} />
      </ul>
    </Section>
  )
}

// 계좌마다 이 기간의 수입·지출·차이. 이월금은 넣지 않는다.
export function ClosingAccountsSection({ closing }: { closing: Closing }) {
  return (
    <Section title="계좌별 금액(이월금 제외)">
      <ul className="flex flex-col gap-3">
        {closing.accounts.map(line => (
          <li key={line.account?.id ?? 'none'} className="flex flex-col gap-0.5 text-sm">
            <span className="text-gray-700 wrap-anywhere">
              {line.account
                ? `${line.account.name}${line.account.closed ? ' (닫음)' : ''}`
                : '계좌 미지정'}
            </span>
            <span className="text-xs text-gray-500">
              수입 {signedWon(line.income)} · 지출 {signedWon(line.expense)} · 차이{' '}
              {signedWon(line.difference)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
