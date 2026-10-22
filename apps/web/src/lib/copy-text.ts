// 클립보드에 글을 넣는다. HTTP 접속이나 오래된 브라우저, 앱 안 브라우저는 막힐 수 있어 성공 여부만 돌려준다.
export async function copyText(value: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}
