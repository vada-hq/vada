import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PushPanel from './PushPanel'
import { currentEnvironment, usePush, type PushEnvironment } from './usePush'

// 대화상자를 열었을 때만 그린다. 그래야 열기 전에는 서버를 부르지 않는다.
export function PushSettingsBody({ environment }: { environment?: PushEnvironment }) {
  const [env] = useState(() => environment ?? currentEnvironment())
  const push = usePush(env)
  return (
    <PushPanel
      state={push.state}
      device={push.device}
      test={push.test}
      enableFailed={push.enableFailed}
      onEnable={push.enable}
      onTest={() => {
        void push.sendTest()
      }}
      onRetry={push.retry}
    />
  )
}

// 옆 메뉴 아래 종 모양 버튼. 휴대폰 알림을 켜고 시험한다(휴대폰 길 spec).
export default function PushSettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="휴대폰 알림"
        title="휴대폰 알림"
        onClick={() => setOpen(true)}
      >
        <Bell />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴대폰 알림</DialogTitle>
            <DialogDescription>새 글과 부름을 휴대폰 알림으로 받아요.</DialogDescription>
          </DialogHeader>
          {open && <PushSettingsBody />}
        </DialogContent>
      </Dialog>
    </>
  )
}
