import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'

// 저장이 막힌 뒤 새로 불러온 값. 쓰던 입력 곁에 두어 맞대 보고 다시 저장하게 한다.
// 나타나면 초점을 옮긴다. 칸이 길면 저장을 누른 자리에서 이 카드가 보이지 않는다.
export function ConflictFacts({
  title,
  fields,
}: {
  title: string
  fields: readonly (readonly [string, string])[]
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => box.current?.focus(), [])
  return (
    <Card
      ref={box}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-4 border-warning-border bg-warning-surface p-5 outline-none"
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 wrap-anywhere whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
