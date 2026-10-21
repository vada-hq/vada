import { useState } from 'react'
import { BellOff } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PUSH_OFF_CHAT } from '@/lib/messages'
import { PushDialog } from './PushSettings'
import { currentEnvironment, usePush, type PushEnvironment } from './usePush'

// 알림을 켜면 받을 수 있는데 꺼져 있는 경우다. 알림을 쓸 수 없는 환경(지원 안 함, 서버 꺼짐)과 불러오는 중에는 띠를 보이지 않는다.
const OFF_STATES = new Set(['ask', 'denied', 'needs-home-screen'])

// 대화 화면 위의 '알림이 꺼져 있어요' 띠. 누르면 알림 대화상자가 열린다.
// 이 컴포넌트가 떠 있는 동안 usePush가 이 기기의 켜진 구독을 지금 계정으로 서버에 저장하므로, 앱을 열 때의 기기 맞추기도 맡는다.
// visible이 거짓이어도(대화 화면이 아니어도) 그 일은 한다.
export default function PushOffBand({
  visible,
  message = PUSH_OFF_CHAT,
  environment,
}: {
  visible: boolean
  // 화면에 맞는 문구. 기본은 대화다.
  message?: string | undefined
  environment?: PushEnvironment
}) {
  const [env] = useState(() => environment ?? currentEnvironment())
  const push = usePush(env)
  const [open, setOpen] = useState(false)
  return (
    <>
      {visible && OFF_STATES.has(push.state) && (
        <Alert tone="warning" className="mx-4 mt-4 flex items-center gap-2 sm:mx-6">
          <BellOff aria-hidden className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">{message}</p>
          <Button variant="link" size="sm" onClick={() => setOpen(true)}>
            알림 켜기
          </Button>
        </Alert>
      )}
      <PushDialog
        open={open}
        onOpenChange={next => {
          setOpen(next)
          // 대화상자에서 켰거나 바꿨으면 띠도 다시 맞춘다.
          if (!next) push.retry()
        }}
      />
    </>
  )
}
