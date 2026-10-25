import { useEffect, useState } from 'react'
import type { WithdrawalResponse } from '@vada/contracts'
import { onPopupLogin } from '../auth/popup-login'
import { signIn, signInInApp } from '../auth/useAuthActions'
import { noteWithdrawn, recheckSession } from '../auth/withdrawn'
import { getJson, postJson } from '@/lib/api'
import { forgetAddress } from '@/lib/last-address'
import { WITHDRAW_ERRORS } from '@/lib/messages'
import { isIosHomeScreenApp } from '@/lib/platform'
import { useLatest } from '@/lib/use-latest'
import { forgetReopen, rememberReopen, wantsReopen } from './withdraw-reopen'

export const WITHDRAW_FAILED = '탈퇴하지 못했어요. 다시 시도해 주세요.'

// 다시 로그인을 시작한다. 실패 글(성공이면 빈 글)과, 이 화면이 남는 로그인 창이었는지를 돌려준다.
// 넘어가는 로그인만 앱을 다시 열므로 돌아와서 확인 창을 열 표시를 남긴다. 로그인 창은 이 화면이 남아 알림으로 되돌린다.
async function startLogin(userId: string): Promise<{ failure: string; inApp: boolean }> {
  const inApp = isIosHomeScreenApp(navigator as { standalone?: boolean })
  if (!inApp) rememberReopen(userId)
  const failure = inApp ? await signInInApp() : await signIn(null)
  if (failure) forgetReopen()
  return { failure, inApp }
}

// 로그인 창에서 고른 계정이 탈퇴하려던 계정인지 본다. 쿠키는 이미 그 창의 로그인 것이다. 읽지 못하면 아니라고 본다.
async function sameAccount(userId: string) {
  const result = await getJson<{ user?: { id?: unknown } } | null>('/api/auth/get-session')
  return result.ok && result.data?.user?.id === userId
}

// 홈 화면 앱은 로그인 창이 따로 열리고 이 화면은 그대로다. 다시 로그인을 기다리는 동안 그 창의 알림을 듣고, 고른 계정이 같은지 알린다.
// 같으면 창을 처음 모습으로 되돌리고, 다르면 창을 닫고 앱이 세션을 다시 읽어 그 계정의 화면으로 바꾼다.
function usePopupLoginBack(waiting: boolean, userId: string, onBack: (same: boolean) => void) {
  const latest = useLatest(onBack)
  useEffect(() => {
    if (!waiting) return
    return onPopupLogin(() => {
      void sameAccount(userId).then(same => latest.current(same))
    })
  }, [waiting, userId, latest])
}

// 탈퇴 확인 창의 상태와 요청(기능 021 조각 7). 창은 옆 메뉴의 내 이름 창과 학생회가 없을 때의 가운데 카드가 연다.
// 로그인한 지 하루가 지났으면 서버가 REAUTH_REQUIRED로 답한다. 그때 [다시 로그인]으로 Google 로그인을 하고 같은 창으로 돌아온다.
// userId는 화면이 보이는 계정이다. 다시 로그인에서 다른 계정을 골랐으면 그 계정으로 탈퇴하지 않는다.
export function useWithdrawal(userId: string) {
  // 같은 계정으로 다시 로그인하고 돌아온 화면이면 처음부터 연다.
  const [open, setOpen] = useState(() => wantsReopen(userId))
  const [busy, setBusy] = useState(false)
  const [reauth, setReauth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(forgetReopen, [])
  usePopupLoginBack(reauth, userId, same => {
    setReauth(false)
    setError(null)
    if (same) return
    setOpen(false)
    recheckSession()
  })

  async function withdraw() {
    setBusy(true)
    setError(null)
    const result = await postJson<WithdrawalResponse>('/api/me/withdrawal', {})
    // 되면 앱이 로그인 전 화면으로 간다. 그동안 다시 누르지 못하게 버튼을 풀지 않는다.
    if (result.ok) {
      forgetAddress(userId)
      noteWithdrawn()
      return
    }
    setBusy(false)
    setReauth(result.code === 'REAUTH_REQUIRED')
    setError(WITHDRAW_ERRORS[result.code] ?? WITHDRAW_FAILED)
  }

  async function login() {
    setBusy(true)
    const { failure, inApp } = await startLogin(userId)
    if (failure) setError(failure)
    // 넘어가는 로그인은 성공하면 페이지가 바뀌므로 버튼을 풀지 않는다.
    if (failure || inApp) setBusy(false)
  }

  return {
    open,
    start: () => {
      setReauth(false)
      setError(null)
      setOpen(true)
    },
    dialog: {
      busy,
      reauth,
      error,
      onWithdraw: () => void withdraw(),
      onLogin: () => void login(),
      onClose: () => setOpen(false),
    },
  }
}
