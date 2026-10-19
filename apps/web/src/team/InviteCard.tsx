import { useEffect, useId, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import type { InviteCodeResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getJson, postJson } from '@/lib/api'
import { inviteLink } from '../councils/invite-path'

type Notice = 'copied' | 'copy-failed' | 'rotated' | 'failed' | null
const notices: Record<Exclude<Notice, null>, { kind: 'notice' | 'error'; text: string }> = {
  copied: { kind: 'notice', text: '초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.' },
  'copy-failed': { kind: 'error', text: '복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.' },
  rotated: { kind: 'notice', text: '코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.' },
  failed: { kind: 'error', text: '코드를 바꾸지 못했어요. 다시 시도해 주세요.' },
}

// 초대 링크(회장단): 링크 복사와 코드 바꾸기. 바꾸면 옛 코드는 막히고 만료는 없다(바탕 spec G2).
export default function InviteCard({ councilId }: { councilId: string }) {
  const base = `/api/organizations/${encodeURIComponent(councilId)}/invite`
  const linkId = useId()
  const [code, setCode] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  useEffect(() => {
    const controller = new AbortController()
    void getJson<InviteCodeResponse>(base, controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (result.ok) setCode(result.data.code)
      else setLoadFailed(true)
    })
    return () => controller.abort()
  }, [base])

  async function copy(link: string) {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(link)
      setNotice('copied')
    } catch {
      setNotice('copy-failed')
    }
  }
  async function rotate() {
    setRotating(true)
    setNotice(null)
    const result = await postJson<InviteCodeResponse>(`${base}/rotate`, {})
    setRotating(false)
    if (!result.ok) return setNotice('failed')
    setCode(result.data.code)
    setNotice('rotated')
  }

  if (!code) return loadFailed ? <StateMessage kind="error">초대 링크를 불러오지 못했어요.</StateMessage> : null
  const link = inviteLink(code)
  return <Card className="flex flex-col gap-3 p-4">
    <section aria-label="초대 링크" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={linkId} className="text-sm font-semibold text-gray-900">초대 링크</Label>
        <p className="text-xs text-gray-500">단톡방에 올리면 누른 사람이 바로 운영진으로 들어와요. 잘못 들어온 사람은 내보내고 코드를 바꿔 주세요.</p>
      </div>
      <Input id={linkId} readOnly value={link} className="font-mono text-base text-gray-500 sm:text-xs" onFocus={event => event.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => { void copy(link) }}><Copy />링크 복사</Button>
        <Button variant="outline" size="sm" disabled={rotating} onClick={() => { void rotate() }}><RefreshCw />{rotating ? '바꾸는 중…' : '코드 바꾸기'}</Button>
      </div>
      {notice && <StateMessage kind={notices[notice].kind}>{notices[notice].text}</StateMessage>}
    </section>
  </Card>
}
