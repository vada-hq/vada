import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { type } from './public-look'

// 공개 화면(신청·내 신청)이 같이 쓰는 생김새: 행사 정보 줄과 구역을 가르는 띠.

// 상자 대신 단 폭 끝까지 가는 회색 띠로 구역을 가른다(앱 목록 화면의 굵은 구분 띠).
export function Band() {
  return <div aria-hidden="true" className="-mx-6 h-2 bg-surface-muted" />
}

// 행사 정보 묶음. 한 줄에 하나씩 아이콘 + 값이고 이름표는 없다(아이콘이 이름표, Luma 행사 페이지·Apple 지갑 패스).
// 가운뎃점으로 이은 회색 덩어리가 세 줄로 흐르면 무엇이 무엇인지 안 읽혔다(대표 지적 10/30).
export function FactList({ children }: { children: ReactNode }) {
  return (
    <ul aria-label="행사 정보" className="flex flex-col gap-3">
      {children}
    </ul>
  )
}

// 정보 한 줄: 테두리 둥근 네모 안 아이콘(36px, 크기·색 통일) + 값. 값이 두 줄이어도 아이콘은 가운데에 선다.
export function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className={`flex min-h-9 items-center gap-3 ${type.label} text-fg-body`}>
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-tertiary ring-1 ring-border-default ring-inset"
      >
        <Icon className="size-4.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{children}</span>
    </li>
  )
}
