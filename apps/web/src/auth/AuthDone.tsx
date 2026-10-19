import { useEffect } from 'react'
import { AuthCard } from '@/components/AuthCard'
import { AUTH_CHANNEL, finishPopupLogin } from './popup-login'

// 홈 화면 앱 안 창에서 Google 로그인이 끝나면 오는 곳. 본 창에 알리고 닫는다. 닫히지 않으면 안내만 남는다.
export default function AuthDone({ failed }: { failed: boolean }) {
  useEffect(() => {
    if (failed) return
    finishPopupLogin(typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL), () => window.close())
  }, [failed])
  return <main className="flex min-h-dvh items-center justify-center p-4">
    <AuthCard>
      <p className="text-sm text-gray-900">{failed ? '로그인이 완료되지 않았어요. 이 창을 닫고 다시 시도해 주세요.' : '로그인했어요. 이 창을 닫아 주세요.'}</p>
    </AuthCard>
  </main>
}
