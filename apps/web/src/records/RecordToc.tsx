import { useEffect, useState } from 'react'
import { NavItem } from '@/components/ui/nav-item'
import { cn } from '@/lib/utils'
import { RECORD_SECTIONS, type RecordSectionId } from './record-view'

// 본문 대목 상자의 id. 목차가 이 id로 대목을 찾는다.
export const sectionAnchor = (id: RecordSectionId) => `record-section-${id}`

// 지금 읽는 대목: 화면 위쪽 띠(위 40%)에 들어온 마지막 대목이다. 목차를 누르면 바로 그 대목이 된다.
// IntersectionObserver가 없는 곳(시험)은 누른 대목만 따른다.
const READING_BAND = '0px 0px -60% 0px'
function useReadingSection() {
  const [current, setCurrent] = useState<RecordSectionId>(RECORD_SECTIONS[0].id)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      entries => {
        const seen = entries.filter(entry => entry.isIntersecting).at(-1)
        const id = RECORD_SECTIONS.find(section => sectionAnchor(section.id) === seen?.target.id)
        if (id) setCurrent(id.id)
      },
      { rootMargin: READING_BAND },
    )
    for (const section of RECORD_SECTIONS) {
      const element = document.getElementById(sectionAnchor(section.id))
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])
  return [current, setCurrent] as const
}

// 왼쪽 목차(와이어프레임 REC-02 '좌측 목차'): 누르면 그 대목으로 옮기고 지금 대목을 강조한다.
// 넓은 화면은 본문 옆에 붙어 따라오는 세로 목록, 휴대폰은 본문 위 가로 칩 줄이다.
export function RecordToc() {
  const [current, setCurrent] = useReadingSection()
  const go = (id: RecordSectionId) => {
    setCurrent(id)
    document
      .getElementById(sectionAnchor(id))
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav
      aria-label="목차"
      className="flex min-w-0 gap-2 overflow-x-auto lg:sticky lg:top-0 lg:w-48 lg:shrink-0 lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:rounded-lg lg:border lg:bg-card lg:p-3 lg:shadow-sm"
    >
      <p className="hidden px-3 pb-1 text-xs font-medium text-fg-muted lg:block">목차</p>
      {RECORD_SECTIONS.map(section => {
        const active = section.id === current
        return (
          // 옆 메뉴 칸과 같은 모양이고, 휴대폰에서는 둥근 칩이다. 쪽 안 위치라 aria-current는 page가 아니라 true다.
          <NavItem
            key={section.id}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'max-lg:mb-0 max-lg:min-h-11 max-lg:w-auto max-lg:shrink-0 max-lg:rounded-full max-lg:border max-lg:border-input max-lg:whitespace-nowrap',
              active && 'bg-accent font-medium text-accent-foreground',
            )}
            onClick={() => go(section.id)}
          >
            {section.label}
          </NavItem>
        )
      })}
    </nav>
  )
}
