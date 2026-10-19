// iOS 홈 화면 앱은 사파리와 쿠키를 따로 쓴다. 앱 안에서 바깥 주소(Google)로 넘어가면 사파리 쪽 창에서 로그인이 끝나 앱은 모른다.
// Apple은 window.open으로 연 창은 홈 화면 앱 안에 머문다고 안내한다(WWDC23). 그래서 누른 순간 앱 안 창을 먼저 열고 그 창을 Google로 보낸다.
// 실제 기기에서 되는지는 확인 전이다(휴대폰 길 spec, 판단 절차 3).
export const AUTH_CHANNEL = 'vada-auth'
export const AUTH_DONE_PATH = '/auth-done'

type Opened = { location: { href: string }; close: () => void } | null
type SignIn = () => Promise<{ data?: { url?: string | undefined } | null; error?: unknown }>

export async function startPopupLogin(
  open: () => Opened,
  signIn: SignIn,
): Promise<'opened' | 'blocked' | 'failed'> {
  // 기다리기 전에 연다. 기다린 뒤에 열면 누른 동작이 아니어서 막힌다.
  const popup = open()
  if (!popup) return 'blocked'
  try {
    const result = await signIn()
    const url = result.data?.url
    if (result.error || !url) throw new Error('Sign-in URL missing')
    popup.location.href = url
    return 'opened'
  } catch {
    popup.close()
    return 'failed'
  }
}

// 로그인이 끝난 창(/auth-done)이 본 창에 알리고 스스로 닫는다.
export function finishPopupLogin(
  channel: { postMessage: (message: string) => void; close: () => void } | null,
  closeWindow: () => void,
) {
  channel?.postMessage('signed-in')
  channel?.close()
  closeWindow()
}
