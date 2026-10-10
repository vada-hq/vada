import { useState } from 'react'
import type { FeeAccount } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = { account: FeeAccount; className?: string }

// 입금할 계좌 상자: 은행·계좌번호·예금주와 계좌번호 복사. 표시와 복사만 하고 API를 부르지 않는다.
// 은행 앱에 붙여 넣기 쉽게 숫자만 복사한다. 복사가 막힌 인앱 브라우저에서도 번호를 길게 눌러 고를 수 있게 글자로 보인다.
export function AccountInfo({ account, className }: Props) {
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  async function copy() {
    try {
      await navigator.clipboard.writeText(account.accountNumber.replace(/-/g, ''))
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }
  return <div className={cn('flex flex-col gap-2 rounded-md border bg-white p-3 text-sm', className)}>
    <dl className="flex flex-col gap-1">
      <div className="flex gap-3"><dt className="w-16 shrink-0 text-gray-500">은행</dt><dd className="wrap-anywhere text-gray-900">{account.bank}</dd></div>
      <div className="flex gap-3"><dt className="w-16 shrink-0 text-gray-500">계좌번호</dt>
        <dd className="font-medium wrap-anywhere text-gray-900 select-all">{account.accountNumber}</dd></div>
      <div className="flex gap-3"><dt className="w-16 shrink-0 text-gray-500">예금주</dt><dd className="wrap-anywhere text-gray-900">{account.holder}</dd></div>
    </dl>
    <Button variant="outline" size="sm" className="self-start" onClick={() => { void copy() }}>계좌번호 복사</Button>
    {copied === 'done' && <StateMessage kind="notice">계좌번호를 복사했어요.</StateMessage>}
    {copied === 'failed' && <StateMessage kind="error">계좌번호를 복사하지 못했어요. 번호를 길게 눌러 복사해 주세요.</StateMessage>}
  </div>
}
