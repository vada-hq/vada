import { useId, useState } from 'react'
import { Copy } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 와이어프레임 ORG-03C. 링크와 코드는 같은 초대 권한이다. 늘 보이므로 복사에 실패하면 직접 선택해 복사한다.
export default function InviteShare({ code }: { code: string }) {
  const link = `${window.location.origin}/join/${code}`
  const linkId = useId()
  const codeId = useId()
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [failed, setFailed] = useState(false)
  async function copy(kind: 'link' | 'code') {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(kind === 'link' ? link : code)
      setCopied(kind)
      setFailed(false)
    } catch {
      setCopied(null)
      setFailed(true)
    }
  }
  return <section className="flex flex-col gap-5" aria-label="학생회 초대">
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={linkId} className="text-gray-600">초대 링크</Label>
      <Input id={linkId} readOnly value={link} className="font-mono text-base text-gray-500 sm:text-xs" onFocus={event => event.currentTarget.select()} />
      <Button variant="outline" size="sm" className="mt-0.5 self-start" onClick={() => { void copy('link') }}><Copy />초대 링크 복사</Button>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={codeId} className="text-gray-600">초대 코드</Label>
      <Input id={codeId} readOnly value={code} className="font-mono text-xl font-bold tracking-widest sm:text-xl" onFocus={event => event.currentTarget.select()} />
      <Button variant="outline" size="sm" className="mt-0.5 self-start" onClick={() => { void copy('code') }}><Copy />코드 복사</Button>
    </div>
    {copied && <StateMessage kind="notice">{`${copied === 'link' ? '초대 링크를' : '초대 코드를'} 복사했어요`}</StateMessage>}
    {failed && <StateMessage kind="error">복사하지 못했어요. 링크나 코드를 직접 선택해 복사해 주세요.</StateMessage>}
  </section>
}
