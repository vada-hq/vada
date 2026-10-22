import { noteTermsRequired } from './api'

const REVOKE_DELAY_MS = 40_000

// 내려받기 머리글의 filename*에서 파일 이름을 꺼낸다. 없거나 깨졌으면 기본 이름이다.
export function downloadName(disposition: string | null, fallback: string) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (!encoded) return fallback
  try {
    return decodeURIComponent(encoded)
  } catch {
    return fallback
  }
}

// 파일을 받아 브라우저 내려받기로 넘긴다. 이름은 서버 머리글의 filename*을 쓴다.
// 실패하면 서버가 준 오류 코드를 돌려준다. 네트워크 실패나 코드가 없으면 null이다.
export async function downloadFile(
  url: string,
  fallbackName: string,
): Promise<{ ok: true } | { ok: false; code: unknown }> {
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: unknown } | null
      noteTermsRequired(response.status, result?.error)
      return { ok: false, code: result?.error ?? null }
    }
    const href = URL.createObjectURL(await response.blob())
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = downloadName(response.headers.get('Content-Disposition'), fallbackName)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    // 아이폰 Safari는 내려받기 확인 창에서 누를 때 파일을 읽으므로 넉넉히 기다린 뒤 주소를 푼다.
    setTimeout(() => URL.revokeObjectURL(href), REVOKE_DELAY_MS)
    return { ok: true }
  } catch {
    return { ok: false, code: null }
  }
}

// 서버가 첨부로 답하면 브라우저는 내려받기만 하고 iframe에 문서가 뜨지 않으므로 load가 오지 않는다. 이만큼 기다려도 문서가 안 뜨면 내려받기가 시작된 것으로 본다.
const FRAME_GRACE_MS = 8_000

// 큰 파일(증빙 묶음)은 메모리에 받지 않고 숨은 iframe의 주소로 받아 브라우저가 바로 저장하게 한다. 화면은 그대로 남는다.
// iframe에 문서가 뜨면(load) 서버가 JSON 오류로 답한 것이다. 같은 출처이므로 본문의 오류 코드를 읽어 돌려주고 iframe을 지운다.
export function saveByFrame(url: string): Promise<{ ok: true } | { ok: false; code: unknown }> {
  return new Promise(done => {
    const frame = document.createElement('iframe')
    frame.hidden = true
    frame.setAttribute('aria-hidden', 'true')
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (result: { ok: true } | { ok: false; code: unknown }) => {
      clearTimeout(timer)
      frame.remove()
      done(result)
    }
    frame.addEventListener('load', () => {
      let code: unknown = null
      try {
        const text = frame.contentDocument?.body?.textContent ?? ''
        code = (JSON.parse(text) as { error?: unknown }).error ?? null
      } catch {
        code = null
      }
      finish({ ok: false, code })
    })
    timer = setTimeout(() => finish({ ok: true }), FRAME_GRACE_MS)
    frame.src = url
    document.body.append(frame)
  })
}
