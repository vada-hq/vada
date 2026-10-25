import type { ReactNode } from 'react'
import kkiruk from './kkiruk-hello.png'

// 끼룩이 한 줄(DEC-87, 와이어프레임 KkirukDone). VADA가 저절로 해 주는 일을 그 자리에 한 줄로만 말한다.
// '해 줬다·해 준다'만 말하고 판단하지 않으며, 경고·막힘·재정 판정에는 쓰지 않는다. 그림은 꾸밈이라 글만 읽힌다.
export function KkirukLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-600">
      <img src={kkiruk} alt="" className="size-6 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}
