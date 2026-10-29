import { useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { openOutsideKakao } from '@/lib/in-app-browser'

type Props = {
  userAgent?: string
  location?: { href: string }
  clipboard?: Pick<Clipboard, 'writeText'>
}

function useCopyAddress(pageUrl: string, clipboard: Props['clipboard']) {
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null)
  async function copy() {
    try {
      if (!clipboard) throw new Error('Clipboard unavailable')
      await clipboard.writeText(pageUrl)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }
  return { copied, copy }
}

function CopyNotice({ copied, pageUrl }: { copied: 'done' | 'failed' | null; pageUrl: string }) {
  if (copied === 'done')
    return (
      <StateMessage kind="notice">
        주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.
      </StateMessage>
    )
  if (copied === 'failed')
    return (
      <>
        <StateMessage kind="error">
          주소를 복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.
        </StateMessage>
        <p className="text-sm wrap-anywhere text-fg select-all">{pageUrl}</p>
      </>
    )
  return null
}

// 카카오톡 안에서는 Google 로그인이 403으로 막힌다. 로그인 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
// 처음 열 때의 자동 넘기기가 막혔어도, 사용자가 누른 동작으로는 넘어갈 수 있다.
export default function KakaoBlock({
  userAgent = navigator.userAgent,
  location = window.location,
  clipboard = navigator.clipboard,
}: Props) {
  const [pageUrl] = useState(() => location.href)
  const { copied, copy } = useCopyAddress(pageUrl, clipboard)
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning">
        카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.
      </Alert>
      <Button
        onClick={() => {
          openOutsideKakao(userAgent, location)
        }}
      >
        바깥 브라우저로 열기
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          void copy()
        }}
      >
        주소 복사
      </Button>
      <CopyNotice copied={copied} pageUrl={pageUrl} />
      <p className="text-xs text-fg-muted">
        안 되면 오른쪽 위나 아래의 메뉴(··· 또는 ⋮)에서 '다른 브라우저로 열기'를 눌러 주세요.
      </p>
    </div>
  )
}
