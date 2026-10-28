import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { TeamMember } from '@vada/contracts'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 제목 앞 표시(회장단의 별, 와이어프레임 ORG-03A HQCard).
  icon?: ReactNode
  // 제목 옆 표시(재정 역할 배지).
  badge?: ReactNode
  // 제목 아래 작은 글(부장 목록, 인원).
  meta: string
  // 머리 오른쪽 끝(부서 ⋯ 메뉴).
  action?: ReactNode
  // 머리 자리를 대신하는 제자리 편집(이름 바꾸기). 있으면 제목은 화면 읽기 프로그램에만 남는다.
  editor?: ReactNode
  // 회장단 카드: 와이어프레임처럼 굵은 테두리와 회색 머리.
  lead?: boolean
  reveal?: boolean
  className?: string
  people: TeamMember[]
  // 묶음 키. 겸직자의 줄이 묶음마다 있어 ⋯ 버튼을 묶음 키와 함께 가린다.
  groupKey: string
  person: (member: TeamMember, groupKey: string) => ReactNode
}

// 조직 화면의 묶음 하나(와이어프레임 ORG-03A의 회장단 카드·부서 카드): 머리(제목, 배지, 작은 글, ⋯)와 그 묶음 사람 목록.
// 사람은 상자 대신 줄로 늘어놓는다(DEC-91, 조사 R3 '묶은 사람 목록').
export function OrgGroupCard({ title, icon, badge, meta, action, editor, lead, ...props }: Props) {
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
      className={cn(
        cardClass,
        'flex min-w-0 flex-col',
        lead && 'border-2 border-gray-300',
        props.className,
      )}
    >
      <div
        className={cn(
          'flex items-start gap-2 border-b px-4 py-3',
          lead && 'rounded-t-lg bg-gray-50',
        )}
      >
        {editor ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            {editor}
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2
                  id={titleId}
                  className="flex min-w-0 items-center gap-1.5 text-sm font-semibold wrap-anywhere text-gray-900"
                >
                  {icon}
                  {title}
                </h2>
                {badge}
              </div>
              <p className="mt-0.5 text-xs wrap-anywhere text-gray-500">{meta}</p>
            </div>
            {action}
          </>
        )}
      </div>
      {props.people.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">구성원 없음</p>
      ) : (
        <ul aria-label={`${title} 구성원`} className="divide-y">
          {props.people.map(member => props.person(member, props.groupKey))}
        </ul>
      )}
    </section>
  )
}
