import { useEffect, useState } from 'react'

// 탈퇴가 끝나면 앱이 세션을 다시 읽어 로그인 전 화면으로 가고, 그 화면에 '탈퇴 완료'를 보인다.
// 탈퇴 창은 작업 공간 깊이(옆 메뉴 아래)에 있어서, 앱이 등록한 처리기로 알린다(lib/api.ts의 401 처리기와 같은 방식).
let onWithdrawn: (() => void) | null = null

export function noteWithdrawn() {
  onWithdrawn?.()
}

// 앱이 쓴다. clear는 다시 로그인을 시작할 때 부른다(다음 로그아웃 화면에 남지 않게).
export function useWithdrawnNotice(refetch: () => unknown) {
  const [withdrawn, setWithdrawn] = useState(false)
  useEffect(() => {
    onWithdrawn = () => {
      setWithdrawn(true)
      void refetch()
    }
    return () => {
      onWithdrawn = null
    }
  }, [refetch])
  return { withdrawn, clear: () => setWithdrawn(false) }
}
