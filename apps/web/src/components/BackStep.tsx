import { useWindowHistory } from '@/lib/use-window-history'

// 기기 뒤로가 화면을 떠나지 않고 onBack으로 오게 기록 한 칸을 쓴다.
export function BackStep({ onBack }: { onBack: () => void }) {
  useWindowHistory(onBack)
  return null
}
