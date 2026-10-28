export async function updateAppBadge(unread: number): Promise<void> {
  try {
    if (unread === 0) await navigator.clearAppBadge?.()
    else await navigator.setAppBadge?.(unread)
  } catch {
    // OS의 배지 허용 여부가 대화나 로그아웃을 막지 않게 한다.
  }
}
