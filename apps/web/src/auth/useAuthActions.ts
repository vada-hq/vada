import { useState } from 'react'
import { invitePath } from '../councils/invite-path'
import { authClient } from './auth-client'
import { forgetThisDevice } from '../push/push-logout'
import { AUTH_DONE_PATH, startPopupLogin } from './popup-login'
import type { Invite } from './useInviteEntry'

const loginStartFailed = '로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'
const loginBlocked = '로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.'
const logoutFailed = '로그아웃하지 못했어요. 다시 시도해 주세요.'

// 아래 동작들은 던지지 않고, 사용자에게 알릴 실패 글을 돌려준다(성공이면 빈 글).
async function signIn(invite: Invite | null): Promise<string> {
  try {
    // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
    const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: callbackURL,
    })
    return result.error ? loginStartFailed : ''
  } catch {
    return loginStartFailed
  }
}

// iOS 홈 화면 앱: 누른 순간 앱 안 창을 열고 그 창에서 Google 로그인을 한다(휴대폰 길 spec 길 B).
async function signInInApp(): Promise<string> {
  try {
    const result = await startPopupLogin(
      () => window.open('about:blank', '_blank'),
      () =>
        authClient.signIn.social({
          provider: 'google',
          callbackURL: AUTH_DONE_PATH,
          errorCallbackURL: `${AUTH_DONE_PATH}?error=1`,
          disableRedirect: true,
        }),
    )
    if (result === 'blocked') return loginBlocked
    return result === 'failed' ? loginStartFailed : ''
  } catch {
    return loginStartFailed
  }
}

async function signOut(): Promise<string> {
  // 이 기기로 이 계정의 알림이 더 오지 않게 먼저 지운다. 못 지워도 로그아웃은 한다.
  await forgetThisDevice()
  try {
    const result = await authClient.signOut()
    return result.error ? logoutFailed : ''
  } catch {
    return logoutFailed
  }
}

// 로그인·로그아웃 동작과 그 진행 상태(busy), 맨 위나 카드 아래에 알릴 실패 글(message).
export function useAuthActions(invite: Invite | null) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).has('error')
      ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.'
      : '',
  )
  // Google 로그인은 성공하면 페이지가 넘어가므로 버튼을 풀지 않는다. 나머지는 늘 푼다(창을 열거나 닫다가 던져도 버튼이 영원히 막히지 않게).
  async function run(task: () => Promise<string>, releaseOnSuccess: boolean) {
    setBusy(true)
    setMessage('')
    const failure = await task()
    setMessage(failure)
    if (failure || releaseOnSuccess) setBusy(false)
  }
  return {
    busy,
    message,
    login: () => run(() => signIn(invite), false),
    loginInApp: () => run(signInInApp, true),
    logout: () => run(signOut, true),
  }
}
