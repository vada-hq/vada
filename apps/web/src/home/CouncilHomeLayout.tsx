import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { greetingDate } from './home-time'
import { calmGreeting } from './ops-view'

// 회장단 홈 배치 L3의 놓기 부품. 배치는 구역을 놓기만 하고 구역의 모양을 덮어쓰지 않는다.
// 구역마다 @container를 따로 둬, 구역은 자기가 놓인 칸의 폭으로 넓은 꼴과 좁은 꼴을 가른다.

const Rule = ({ className }: { className?: string }) => (
  <div aria-hidden className={cn('h-px shrink-0 bg-border', className)} />
)

const Zone = ({ children }: { children: ReactNode }) => (
  <div className="@container min-w-0">{children}</div>
)

// 머리: 날짜 + 인사 한 줄. ①이 0건인 날(calm)은 인사 대신 calmGreeting 한 문장으로 ①을 합친다.
// 왼쪽 끝을 구역 머리 글(쟁반 머리 여백)에 맞춘다.
export function CouncilHead({ today, name, calm }: { today: string; name: string; calm: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-4.5 @2xl:px-5.5">
      <p className="text-row-sub font-semibold text-fg-secondary">{greetingDate(today)}</p>
      <h2
        className={cn(
          'text-row-sub break-keep',
          calm ? 'font-medium text-fg-secondary' : 'font-normal text-fg-tertiary',
        )}
      >
        {calm ? calmGreeting(name) : `${name}님, 안녕하세요`}
      </h2>
    </div>
  )
}

// 아래 두 단: 넓으면(본문 56rem 이상, 1280 창) 왼쪽 ② | 오른쪽 ③⑤·사용 가능(내용 폭 휴대폰 구역 폭과 같은 약 358px),
// 좁으면 한 단. 구역 사이는 얇은 선(두 단 사이 세로선, 그 밖은 가로선)이다.
export function CouncilSplit({
  ruleAbove,
  left,
  right,
  bottomRight,
}: {
  // ①이 위에 있으면 ①과 이 줄 사이에 가로선
  ruleAbove: boolean
  left: ReactNode
  // 오른쪽 단 구역들(사이에 가로선)
  right: ReactNode[]
  // 오른쪽 단 맨 아래 한 줄(사용 가능). 선 없이 붙인다.
  bottomRight?: ReactNode
}) {
  return (
    <>
      {ruleAbove && <Rule />}
      <div className="flex flex-col gap-4 @2xl:gap-6 @4xl:flex-row @4xl:items-stretch @4xl:gap-0">
        <div className="flex min-w-0 flex-1 flex-col gap-4 @2xl:gap-6 @4xl:pr-6">
          <Zone>{left}</Zone>
          <Rule className="@4xl:hidden" />
        </div>
        <div className="flex min-w-0 flex-col gap-4 @2xl:gap-6 @4xl:w-96 @4xl:shrink-0 @4xl:border-l @4xl:border-border @4xl:pl-6">
          {right.map((zone, index) => (
            <Fragment key={index}>
              {index > 0 && <Rule />}
              <Zone>{zone}</Zone>
            </Fragment>
          ))}
          {bottomRight && <Zone>{bottomRight}</Zone>}
        </div>
      </div>
    </>
  )
}
