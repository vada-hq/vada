import { useState } from 'react'
import type { CalendarKind } from '@vada/contracts'
import { CalendarView } from '@/calendar/CalendarView'
import type { CalendarLayout } from '@/calendar/CalendarHeader'
import { useCalendarNavigation } from '@/calendar/use-calendar-navigation'
import { calendarItems } from '@/test-support/calendar-fixtures'
import { Section } from './GallerySection'

const noop = () => {}

function CalendarExample({ initialLayout }: { initialLayout: CalendarLayout }) {
  const navigation = useCalendarNavigation('2026-10-28')
  const [layout, setLayout] = useState(initialLayout)
  const [kind, setKind] = useState<CalendarKind | null>(null)
  return (
    <CalendarView
      {...navigation}
      onMonth={navigation.go}
      onSelect={navigation.setSelected}
      items={calendarItems}
      layout={layout}
      kind={kind}
      onLayout={setLayout}
      onKind={setKind}
      onOpen={noop}
    />
  )
}

export function CalendarSection() {
  return (
    <Section title="캘린더">
      <div className="w-full min-w-0">
        <h3 className="mb-3 text-sm font-medium">월 보기</h3>
        <CalendarExample initialLayout="month" />
      </div>
      <div className="w-full min-w-0">
        <h3 className="my-3 text-sm font-medium">목록 보기</h3>
        <CalendarExample initialLayout="list" />
      </div>
    </Section>
  )
}
