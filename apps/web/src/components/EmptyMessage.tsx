import type { ReactNode } from 'react'
import StateMessage from './StateMessage'

// 빈 화면 문구. 그 일을 할 수 없는 사람에게는 누가 하는지 한 줄을 더한다(navigation.md 이동 규칙 9).
// 할 수 있는지는 부르는 쪽이 서버가 준 권한으로 정해 넘긴다(DEC-38).
export function EmptyMessage({ who, children }: { who: string | null; children: ReactNode }) {
  if (!who) return <StateMessage kind="empty">{children}</StateMessage>
  return (
    <div className="flex flex-col gap-1">
      <StateMessage kind="empty">{children}</StateMessage>
      <p className="text-xs text-fg-muted">{who}</p>
    </div>
  )
}
