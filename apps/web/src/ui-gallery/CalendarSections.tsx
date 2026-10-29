import { useState } from 'react'
import type { CalendarKind } from '@vada/contracts'
import { ScheduleDialog } from '@/calendar/ScheduleDialog'
import { ScheduleDetail } from '@/calendar/ScheduleDetail'
import { Button } from '@/components/ui/button'
import { CalendarView } from '@/calendar/CalendarView'
import type { CalendarLayout } from '@/calendar/CalendarHeader'
import { useCalendarNavigation } from '@/calendar/use-calendar-navigation'
import { calendarItems, calendarMeetingItem } from '@/test-support/calendar-fixtures'
import { DEPARTMENT_ID, EVENT_ID, scheduleDetail } from '@/test-support/schedule-fixtures'
import { Section } from './GallerySection'

const noop = () => {}

function CalendarExample({
  initialLayout,
  onCreate,
}: {
  initialLayout: CalendarLayout
  onCreate: (date: string) => void
}) {
  const navigation = useCalendarNavigation('2026-10-28')
  const [layout, setLayout] = useState(initialLayout)
  const [kind, setKind] = useState<CalendarKind | null>(null)
  return (
    <CalendarView
      {...navigation}
      onMonth={navigation.go}
      onSelect={navigation.setSelected}
      items={[...calendarItems, calendarMeetingItem]}
      layout={layout}
      kind={kind}
      onLayout={setLayout}
      onKind={setKind}
      onOpen={noop}
      onCreate={onCreate}
    />
  )
}

export function CalendarSection() {
  const [open, setOpen] = useState<'empty' | 'errors' | 'edit' | 'detail' | 'readonly' | null>(null)
  const [date, setDate] = useState('2026-10-28')
  const create = (day: string) => {
    setDate(day)
    setOpen('empty')
  }
  const close = () => setOpen(null)
  return (
    <Section title="캘린더">
      <div className="w-full min-w-0">
        <h3 className="mb-3 text-sm font-medium">월 보기</h3>
        <CalendarExample initialLayout="month" onCreate={create} />
      </div>
      <div className="w-full min-w-0">
        <h3 className="my-3 text-sm font-medium">목록 보기</h3>
        <CalendarExample initialLayout="list" onCreate={create} />
      </div>
      <div className="flex w-full flex-wrap gap-2">
        <Button variant="outline" touch onClick={() => setOpen('empty')}>
          빈 일정 창 열기
        </Button>
        <Button variant="outline" touch onClick={() => setOpen('errors')}>
          일정 오류 창 열기
        </Button>
        <Button variant="outline" touch onClick={() => setOpen('detail')}>
          일정 상세 열기
        </Button>
        <Button variant="outline" touch onClick={() => setOpen('readonly')}>
          읽기 전용 일정 상세 열기
        </Button>
      </div>
      {(open === 'empty' || open === 'errors' || open === 'edit') && (
        <ScheduleDialog
          initialDate={date}
          item={open === 'edit' ? scheduleDetail() : undefined}
          showErrors={open === 'errors'}
          departments={[{ id: DEPARTMENT_ID, name: '기획부' }]}
          events={[{ id: EVENT_ID, name: '가을 축제' }]}
          onClose={close}
          onSave={() => {
            close()
            return Promise.resolve(null)
          }}
        />
      )}
      {(open === 'detail' || open === 'readonly') && (
        <ScheduleDetail
          councilId="0199d1a0-0000-7000-8000-0000000000c1"
          item={scheduleDetail(open === 'readonly' ? { actions: [] } : {})}
          onClose={close}
          onEdit={() => setOpen('edit')}
          onDelete={() => {
            close()
            return Promise.resolve(null)
          }}
        />
      )}
    </Section>
  )
}
