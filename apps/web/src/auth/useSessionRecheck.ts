import { useEffect } from 'react'
import { setUnauthorizedHandler } from '@/lib/api'
import { onPopupLogin } from './popup-login'

// iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
// 로그인이 풀려 API가 401을 주면 어디서나 세션을 다시 읽는다. 세션이 없으면 로그인 화면으로 돌아간다.
export function useSessionRecheck(
  homeScreenApp: boolean,
  signedIn: boolean,
  refetch: () => unknown,
) {
  useEffect(() => {
    if (!homeScreenApp || signedIn) return
    const recheck = () => {
      void refetch()
    }
    const stopListening = onPopupLogin(recheck)
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopListening()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [homeScreenApp, signedIn, refetch])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void refetch()
    })
    return () => setUnauthorizedHandler(null)
  }, [refetch])
}
