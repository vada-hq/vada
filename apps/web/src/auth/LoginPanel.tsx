import { Button } from '@/components/ui/button'
import KakaoBlock from './KakaoBlock'

type Props = { kakao: boolean; busy: boolean; onLogin: () => void }

// 로그인 화면의 가운데. 카카오톡 안에서는 Google 로그인이 막히므로 버튼 대신 바깥 브라우저로 넘어가는 길을 보여 준다.
export default function LoginPanel({ kakao, busy, onLogin }: Props) {
  if (kakao) return <KakaoBlock />
  return <div className="flex flex-col gap-3">
    <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
    <Button disabled={busy} onClick={onLogin}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</Button>
  </div>
}
