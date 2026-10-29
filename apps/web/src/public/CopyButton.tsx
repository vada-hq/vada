import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/copy-text'

type Props = { value: string; label: string; failedHint: string }

// 복사 버튼. 앱 안 브라우저에서 막히면 길게 눌러 복사하도록 값을 그 자리에 보인다.
export default function CopyButton({ value, label, failedHint }: Props) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="outline"
        size="sm"
        touch
        className="self-start"
        onClick={() => {
          void copyText(value).then(ok => setResult(ok ? 'copied' : 'failed'))
        }}
      >
        {result === 'copied' ? '복사했어요' : label}
      </Button>
      {result === 'failed' && (
        <p role="status" className="text-xs text-fg-muted wrap-anywhere">
          {failedHint} <span className="text-fg select-all">{value}</span>
        </p>
      )}
    </div>
  )
}
