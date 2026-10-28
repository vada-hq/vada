import { Button } from '@/components/ui/button'

export function LedgerKind({
  income,
  onChange,
}: {
  income: boolean
  onChange: (income: boolean) => void
}) {
  return (
    <div role="group" aria-label="사용 내역 구분" className="flex flex-wrap gap-2">
      {[false, true].map(value => (
        <Button
          key={String(value)}
          size="sm"
          touch
          className="break-keep"
          variant={income === value ? 'secondary' : 'outline'}
          aria-pressed={income === value}
          onClick={() => onChange(value)}
        >
          {value ? '수입' : '지출'}
        </Button>
      ))}
    </div>
  )
}
