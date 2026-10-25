import { useEffect, useState } from 'react'

// 탈퇴 창은 작업 공간 깊이(옆 메뉴 아래)에 있어서, 앱의 세션에 할 일을 앱이 등록한 처리기로 알린다(lib/api.ts의 401 처리기와 같은 방식).
// 탈퇴가 끝나면 세션을 다시 읽어 로그인 전 화면으로 가고 '탈퇴 완료'를 보인다. 다시 로그인에서 다른 계정을 골랐으면 세션만 다시 읽는다.
let onWithdrawn: (() => void) | null = null
let onRecheck: (() => void) | null = null

export function noteWithdrawn() {
  onWithdrawn?.()
}

export function recheckSession() {
  onRecheck?.()
}

// 앱이 쓴다. clear는 다시 로그인을 시작할 때 부른다(다음 로그아웃 화면에 남지 않게).
export function useWithdrawnNotice(refetch: () => unknown) {
  const [withdrawn, setWithdrawn] = useState(false)
  useEffect(() => {
    onWithdrawn = () => {
      setWithdrawn(true)
      void refetch()
    }
    onRecheck = () => {
      void refetch()
    }
    return () => {
      onWithdrawn = null
      onRecheck = null
    }
  }, [refetch])
  return { withdrawn, clear: () => setWithdrawn(false) }
}
