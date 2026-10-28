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
      {/* 지출 카드는 제목 단추의 덮개가 카드 전체를 덮으므로 이 단추를 덮개 위로 올린다. */}
      <Button
        variant="outline"
        size="sm"
        touch
        className="relative z-10"
        onClick={() => void copy()}
      >
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
