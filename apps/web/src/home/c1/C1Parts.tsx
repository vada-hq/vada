import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import type { S7Person } from '../s7/s7-data'
import { initialOf, type C1Row } from './c1-view'

// C1 두 안이 같이 쓰는 틀: 카드, 머리, 줄 제목, '전체 보기', 이름 첫 글자 얼굴.
// 색은 셋만 쓴다: 위험(red-700, 지남·오늘), 강조(blue-700, 링크·행동), 나머지 회색.

export const TITLE = '확인이 필요한 운영 상황'
export const HEAD_ID = 'c1-head'
export const WRAP = 'break-keep wrap-anywhere'

export function Card({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby={HEAD_ID} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {children}
    </section>
  )
}

// 머리: 제목 + 전체 수(회색). 상한을 넘을 때의 '전체 보기'는 목록 끝에 둔다(목록을 다 읽은 자리).
export function Head({ total }: { total: number }) {
  return (
    <div className="flex items-baseline gap-2 px-4 pt-4 pb-3 @2xl:px-5">
      <h2 id={HEAD_ID} className={cn('text-base font-semibold text-gray-900', WRAP)}>
        {TITLE}
      </h2>
      {total > 0 && <span className="text-sm font-medium text-gray-500">{total}</span>}
    </div>
  )
}

// 정상인 날: 한 줄로 접는다. 상자 높이를 거의 쓰지 않아 아래 구역이 올라온다.
export function Calm() {
  return (
    <section
      aria-labelledby={HEAD_ID}
      className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-gray-200 bg-white px-4 py-3 @2xl:px-5"
    >
      <h2 id={HEAD_ID} className={cn('text-base font-semibold text-gray-900', WRAP)}>
        {TITLE}
      </h2>
      <span className="text-sm text-gray-500">없음</span>
    </section>
  )
}

export function SeeAll({ total, onClick }: { total: number; onClick: () => void }) {
  return (
    <div className="border-t border-gray-100 px-4 py-2 @2xl:px-5">
      <Button variant="link" className="h-auto gap-1 p-0 text-sm max-sm:min-h-11" onClick={onClick}>
        {`전체 ${total}건 보기`}
        <ChevronRight />
      </Button>
    </div>
  )
}

// 줄 제목: 줄 전체를 누르는 자리(row-link). 누르면 그 업무·요청으로.
export function RowTitle({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Button
      variant="link"
      touch={false}
      className={cn(
        'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 hover:no-underline',
        WRAP,
        rowLinkTarget,
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

// 대화 화면의 얼굴과 같은 모양(chat/MessageItem.tsx): 흰 원에 이름 첫 글자.
export function Face({ person, size = 'md' }: { person: S7Person; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white font-bold text-gray-500',
        size === 'md' ? 'size-8 text-xs' : 'size-6 text-xs',
      )}
    >
      {initialOf(person)}
    </span>
  )
}

export const factClass = (row: C1Row) =>
  cn('text-sm font-semibold whitespace-nowrap', row.tone === 'danger' ? 'text-red-700' : 'text-gray-900')

export type RowHandlers = { onOpen: (row: C1Row) => void; onAsk: (row: C1Row) => void; onAssign: (row: C1Row) => void }
