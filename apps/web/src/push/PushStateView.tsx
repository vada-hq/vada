import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { Device } from '@/lib/platform'
import type { PushState } from './push-state'

const deniedHelp = {
  ios: '설정 → 알림 → VADA에서 켜 주세요.',
  android: '브라우저 메뉴의 사이트 설정 → 알림에서 VADA를 허용해 주세요.',
  other: '브라우저의 사이트 설정에서 알림을 허용해 주세요.',
} as const

type Props = {
  state: PushState
  device: Device
  enableFailed: boolean
  testSending: boolean
  onEnable: () => void
  onTest: () => void
  onRetry: () => void
}

function NeedsHomeScreen() {
  return (
    <>
      <p className="text-fg">아이폰은 홈 화면에 추가해야 알림을 받아요.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>아래쪽 공유 버튼을 눌러요.</li>
        <li>'홈 화면에 추가'를 눌러요.</li>
        <li>홈 화면의 VADA로 열어요.</li>
      </ol>
      <p className="text-xs text-fg-muted">로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.</p>
    </>
  )
}

function Unsupported({ device }: { device: Device }) {
  return (
    <p>
      이 브라우저는 알림을 받을 수 없어요.
      {device === 'ios'
        ? ' iOS 16.4 이상에서 홈 화면의 VADA로 열어 주세요.'
        : ' Chrome이나 삼성 인터넷으로 열어 주세요.'}
    </p>
  )
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <StateMessage kind="error">알림 설정을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={onRetry}>
        다시 시도
      </Button>
    </>
  )
}

function Ask({ enableFailed, onEnable }: { enableFailed: boolean; onEnable: () => void }) {
  return (
    <>
      <Button className="self-start" onClick={onEnable}>
        알림 켜기
      </Button>
      {enableFailed && (
        <StateMessage kind="error">알림을 켜지 못했어요. 다시 눌러 주세요.</StateMessage>
      )}
    </>
  )
}

function On({ sending, onTest }: { sending: boolean; onTest: () => void }) {
  return (
    <>
      <p className="text-fg">이 기기에서 알림을 받아요.</p>
      <Button variant="outline" className="self-start" busy={sending} onClick={onTest}>
        시험 알림 보내기
      </Button>
    </>
  )
}

// 알림 상태마다 한 가지만 보여 준다(휴대폰 길 spec의 표).
export default function PushStateView({
  state,
  device,
  enableFailed,
  testSending,
  onEnable,
  onTest,
  onRetry,
}: Props) {
  switch (state) {
    case 'loading':
      return <StateMessage kind="loading">알림 설정을 확인하는 중…</StateMessage>
    case 'needs-home-screen':
      return <NeedsHomeScreen />
    case 'unsupported':
      return <Unsupported device={device} />
    case 'server-off':
      return <p>아직 알림을 쓸 수 없어요.</p>
    case 'failed':
      return <Failed onRetry={onRetry} />
    case 'ask':
      return <Ask enableFailed={enableFailed} onEnable={onEnable} />
    case 'denied':
      return <p>알림이 꺼져 있어요. {deniedHelp[device]}</p>
    case 'on':
      return <On sending={testSending} onTest={onTest} />
  }
}
