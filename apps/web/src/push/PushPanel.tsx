import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { Device } from '@/lib/platform'
import type { PushState } from './push-state'
import type { PushTest } from './usePush'

type Props = { state: PushState; device: Device; test: PushTest; enableFailed: boolean
  onEnable: () => void; onTest: () => void; onRetry: () => void }

const resultText = {
  sent: '보냈어요. 알림이 왔는지 확인해 주세요.',
  expired: '이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.',
  rejected: '알림 서버가 받지 않았어요.',
} as const
const deniedHelp = {
  ios: '설정 → 알림 → VADA에서 켜 주세요.',
  android: '브라우저 메뉴의 사이트 설정 → 알림에서 VADA를 허용해 주세요.',
  other: '브라우저의 사이트 설정에서 알림을 허용해 주세요.',
} as const

// 휴대폰 알림 대화상자의 내용. 상태마다 한 가지만 보여 준다(휴대폰 길 spec의 표). API를 부르지 않는다.
export default function PushPanel({ state, device, test, enableFailed, onEnable, onTest, onRetry }: Props) {
  return <div className="flex flex-col gap-3 text-sm text-gray-700">
    {state === 'loading' && <StateMessage kind="loading">알림 설정을 확인하는 중…</StateMessage>}
    {state === 'needs-home-screen' && <>
      <p className="text-gray-900">아이폰은 홈 화면에 추가해야 알림을 받아요.</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>아래쪽 공유 버튼을 눌러요.</li>
        <li>'홈 화면에 추가'를 눌러요.</li>
        <li>홈 화면의 VADA로 열어요.</li>
      </ol>
      <p className="text-xs text-gray-500">로그인한 채로 추가하면 다시 로그인하지 않아도 돼요.</p>
    </>}
    {state === 'unsupported' && <p>이 브라우저는 알림을 받을 수 없어요.{device === 'ios'
      ? ' iOS 16.4 이상에서 홈 화면의 VADA로 열어 주세요.' : ' Chrome이나 삼성 인터넷으로 열어 주세요.'}</p>}
    {state === 'server-off' && <p>아직 알림을 쓸 수 없어요.</p>}
    {state === 'failed' && <>
      <StateMessage kind="error">알림 설정을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={onRetry}>다시 시도</Button>
    </>}
    {state === 'ask' && <Button className="self-start" onClick={onEnable}>알림 켜기</Button>}
    {state === 'ask' && enableFailed && <StateMessage kind="error">알림을 켜지 못했어요. 다시 눌러 주세요.</StateMessage>}
    {state === 'denied' && <p>알림이 꺼져 있어요. {deniedHelp[device]}</p>}
    {state === 'on' && <>
      <p className="text-gray-900">이 기기에서 알림을 받아요.</p>
      <Button variant="outline" className="self-start" disabled={test.kind === 'sending'} onClick={onTest}>시험 알림 보내기</Button>
    </>}
    {test.kind === 'sending' && <StateMessage kind="notice">5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.</StateMessage>}
    {test.kind === 'result' && <StateMessage kind={test.result === 'sent' ? 'notice' : 'error'}>{resultText[test.result]}</StateMessage>}
    {test.kind === 'unsupported-service' && <StateMessage kind="error">이 브라우저의 알림 서버({test.host})는 아직 받지 않아요.</StateMessage>}
    {test.kind === 'failed' && <StateMessage kind="error">시험 알림을 보내지 못했어요. 연결을 확인해 주세요.</StateMessage>}
    {test.kind === 'unknown' && <StateMessage kind="notice">결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요.</StateMessage>}
  </div>
}
