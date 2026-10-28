import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/copy-text'

export function CalendarFeedAddress({ url }: { url: string }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const webcal = url.replace(/^https?:/, 'webcal:')
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-end gap-2">
        <Field label="구독 주소" className="min-w-0 flex-1">
          <Input
            value={url}
            readOnly
            className="max-sm:min-h-11"
            onFocus={event => event.currentTarget.select()}
          />
        </Field>
        <Button
          variant="outline"
          touch
          onClick={() => void copyText(url).then(ok => setCopied(ok ? 'copied' : 'failed'))}
        >
          복사
        </Button>
      </div>
      {copied !== 'idle' && (
        <p role="status" className="text-sm text-gray-500">
          {copied === 'copied' ? '복사했어요.' : '주소를 길게 눌러 복사해 주세요.'}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:items-start">
        <a
          className={buttonVariants({ variant: 'outline', touch: true })}
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google 캘린더에 추가
        </a>
        <a className={buttonVariants({ variant: 'outline', touch: true })} href={webcal}>
          Apple·Outlook에서 열기
        </a>
      </div>
      <div className="space-y-1 text-sm text-gray-500">
        <p>Google 캘린더는 컴퓨터에서 추가해요.</p>
        <p>주소는 이 창을 닫으면 다시 볼 수 없어요.</p>
      </div>
    </div>
  )
}
