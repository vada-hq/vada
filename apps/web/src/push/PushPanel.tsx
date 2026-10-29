import type { Device } from '@/lib/platform'
import type { PushState } from './push-state'
import type { PushTest } from './push-test'
import PushStateView from './PushStateView'
import PushTestNotice from './PushTestNotice'

type Props = {
  state: PushState
  device: Device
  test: PushTest
  enableFailed: boolean
  onEnable: () => void
  onTest: () => void
  onRetry: () => void
}

// 휴대폰 알림 대화상자의 내용. 상태마다 한 가지만 보여 준다(휴대폰 길 spec의 표). API를 부르지 않는다.
export default function PushPanel({
  state,
  device,
  test,
  enableFailed,
  onEnable,
  onTest,
  onRetry,
}: Props) {
  return (
    <div className="flex flex-col gap-3 text-sm text-fg-secondary">
      <PushStateView
        state={state}
        device={device}
        enableFailed={enableFailed}
        testSending={test.kind === 'sending'}
        onEnable={onEnable}
        onTest={onTest}
        onRetry={onRetry}
      />
      <PushTestNotice test={test} />
    </div>
  )
}
