import { useState } from 'react'
import StateMessage from '../shared/ui/StateMessage'

// 와이어프레임 ORG-03C. 링크와 코드는 같은 초대 권한이다.
export default function InviteShare({ code }: { code: string }) {
  const link = `${window.location.origin}/join/${code}`
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
  return <section className="sidebar-invite" aria-label="학생회 초대">
    <button className="button-quiet" onClick={() => { void copy('link') }}>초대 링크 복사</button>
    <button className="button-quiet" onClick={() => { void copy('code') }}>코드 복사</button>
    {copied && <StateMessage kind="notice">{`${copied === 'link' ? '초대 링크를' : '초대 코드를'} 복사했어요`}</StateMessage>}
    {failed && <>
      <StateMessage kind="error">복사하지 못했어요. 아래에서 직접 복사해 주세요.</StateMessage>
      <label>초대 링크<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
      <label>초대 코드<input readOnly value={code} onFocus={event => event.currentTarget.select()} /></label>
    </>}
  </section>
}
