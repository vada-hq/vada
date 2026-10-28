import { useState } from 'react'
import type { ExpenseSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy-text'
import { copyExpenseRow } from './expense-filter'

export function ExpenseCopyButton({ expense }: { expense: ExpenseSummary }) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async () =>
    setCopied(
      (await copyText(copyExpenseRow(expense)))
        ? '행 복사 완료'
        : '복사하지 못했어요. 다시 눌러 주세요.',
    )
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" touch onClick={() => void copy()}>
        행 복사
      </Button>
      {copied && (
        <span role="status" className="text-xs break-keep text-gray-500">
          {copied}
        </span>
      )}
    </div>
  )
}
