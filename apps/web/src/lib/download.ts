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

// 큰 파일(증빙 묶음)은 메모리에 받지 않고 주소로 이동해 브라우저가 바로 저장하게 한다. 서버가 Content-Disposition으로 내려받기를 지시하므로 화면은 그대로 남는다.
export function saveByNavigation(url: string) {
  window.location.assign(url)
}
