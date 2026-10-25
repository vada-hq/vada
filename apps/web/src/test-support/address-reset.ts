import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'

// 시험이 바꾼 주소와 창 기록이 다음 시험에 남지 않게 한다. 화면을 치운(cleanup) 뒤에 부른다.
export async function resetAddress() {
  await windowHistoryIdle()
  resetWindowHistory()
  window.history.replaceState(null, '', '/')
}
