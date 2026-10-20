import StateMessage from '@/components/StateMessage'
import type { PushTest } from './push-test'

const resultText = {
  sent: '보냈어요. 알림이 왔는지 확인해 주세요.',
  expired: '이 기기의 알림 등록이 끝났어요. 알림을 다시 켜 주세요.',
  rejected: '알림 서버가 받지 않았어요.',
} as const

// 시험 알림을 보낸 뒤의 안내. 보내기 전(idle)에는 아무것도 보이지 않는다.
export default function PushTestNotice({ test }: { test: PushTest }) {
  switch (test.kind) {
    case 'idle':
      return null
    case 'sending':
      return (
        <StateMessage kind="notice">
          5초 뒤에 알림이 와요. 화면을 끄거나 홈으로 나가 기다려 보세요.
        </StateMessage>
      )
    case 'result':
      return (
        <StateMessage kind={test.result === 'sent' ? 'notice' : 'error'}>
          {resultText[test.result]}
        </StateMessage>
      )
    case 'unsupported-service':
      return (
        <StateMessage kind="error">
          이 브라우저의 알림 서버({test.host})는 아직 받지 않아요.
        </StateMessage>
      )
    case 'failed':
      return (
        <StateMessage kind="error">시험 알림을 보내지 못했어요. 연결을 확인해 주세요.</StateMessage>
      )
    case 'unknown':
      return (
        <StateMessage kind="notice">결과를 받지 못했어요. 알림이 왔다면 잘 된 거예요.</StateMessage>
      )
  }
}
