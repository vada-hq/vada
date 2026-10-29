import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { TeamMember } from '@vada/contracts'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 제목 앞 표시(회장단의 별, 부서 색 점).
  icon?: ReactNode
  // 제목 옆 표시(재정 역할 배지).
  badge?: ReactNode
  // 머리 오른쪽의 작은 글(인원, 부장이 없으면 '부장 없음').
  meta: string
  // 머리 오른쪽 끝(부서 ⋯ 메뉴).
  action?: ReactNode
  // 머리 자리를 대신하는 제자리 편집(이름 바꾸기). 있으면 제목은 화면 읽기 프로그램에만 남는다.
  editor?: ReactNode
  // 격자 한 줄을 다 차지하는 묶음(회장단, 미배정). 사람 줄을 부서 칸과 같은 단으로 늘어놓아
  // 회장단 사람이 아래 부서 칸과 같은 세로줄에 선다.
  wide?: boolean
  reveal?: boolean
  className?: string
  people: TeamMember[]
  // 묶음 키. 겸직자의 줄이 묶음마다 있어 ⋯ 버튼을 묶음 키와 함께 가린다.
  groupKey: string
  person: (member: TeamMember, groupKey: string) => ReactNode
}

// 넓은 묶음의 단 수는 OrgLayout의 부서 격자와 같다(같은 @container를 본다).
const wideList =
  'grid @2xl:grid-cols-2 @2xl:gap-x-4 @2xl:divide-y-0 @4xl:grid-cols-3 @6xl:grid-cols-4'

// 조직 화면의 묶음 하나(와이어프레임 ORG-03A의 회장단 카드·부서 카드): 한 줄 머리(제목, 배지, 인원, ⋯)와 그 묶음 사람 목록.
// 사람은 상자 대신 줄로 늘어놓는다(DEC-91, 조사 R3 '묶은 사람 목록').
export function OrgGroupCard({ title, icon, badge, meta, action, editor, wide, ...props }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!props.reveal) return
    ref.current?.scrollIntoView?.({ block: 'start' })
    ref.current?.focus({ preventScroll: true })
  }, [props.reveal])
  return (
    <section
      ref={ref}
      tabIndex={props.reveal ? -1 : undefined}
      aria-labelledby={titleId}
      className={cn(cardClass, 'flex min-w-0 flex-col', props.className)}
    >
      <div className="flex min-h-11 items-center gap-2 border-b px-4 py-1.5">
        {editor ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {editor}
          </>
        ) : (
          <>
            <h2
              id={titleId}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold wrap-anywhere text-fg"
            >
              {icon}
              {title}
            </h2>
            {badge}
            <p className="ml-auto shrink-0 text-xs text-fg-muted">{meta}</p>
            {action}
          </>
        )}
      </div>
      {props.people.length === 0 ? (
        <p className="px-4 py-3 text-sm text-fg-muted">구성원 없음</p>
      ) : (
        <ul aria-label={`${title} 구성원`} className={cn('divide-y', wide && wideList)}>
          {props.people.map(member => props.person(member, props.groupKey))}
        </ul>
      )}
    </section>
  )
}
