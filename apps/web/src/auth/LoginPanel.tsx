import { Button } from '@/components/ui/button'
import KakaoBlock from './KakaoBlock'

type Props = { kakao: boolean; homeScreenApp: boolean; busy: boolean; onLogin: () => void; onLoginInApp: () => void }

// 로그인 화면의 가운데. 카카오톡 안에서는 Google 로그인이 막히므로 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
// iOS 홈 화면 앱은 앱 안 창 로그인을 기본으로, 지금처럼 넘기는 로그인을 둘째로 둔다. 둘 다 안 될 때의 길도 늘 적어 둔다.
export default function LoginPanel({ kakao, homeScreenApp, busy, onLogin, onLoginInApp }: Props) {
  if (kakao) return <KakaoBlock />
  const label = busy ? 'Google로 이동 중…' : 'Google로 로그인'
  if (homeScreenApp) return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLoginInApp}>{label}</Button>
    <Button variant="link" disabled={busy} onClick={onLogin}>다른 방법으로 로그인</Button>
    <p className="text-xs text-gray-500">로그인이 안 되면 사파리에서 VADA에 로그인한 뒤, 홈 화면의 VADA를 지우고 다시 추가해 주세요.</p>
  </div>
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLogin}>{label}</Button>
  </div>
}
