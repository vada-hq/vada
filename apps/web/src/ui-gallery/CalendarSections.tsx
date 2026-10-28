import { CalendarView } from '@/calendar/CalendarView'
import { eventSummary } from '@/test-support/event-fixtures'
import { Section } from './GallerySection'

const noop = () => {}

export function CalendarSection() {
  return (
    <Section title="캘린더">
      <div className="w-full min-w-0">
        <CalendarView
          today="2026-10-28"
          onOpenTask={noop}
          onOpenEvent={noop}
          tasks={[
            {
              id: '0199d1a0-0000-7000-8000-0000000000a1',
              title: '가을 축제 현수막 주문과 설치 위치 확인',
              dueDate: '2026-10-28',
              status: 'todo',
              next: 'in_progress',
              overdue: false,
              department: { id: '0199d1a0-0000-7000-8000-0000000000d1', name: '기획부' },
              event: null,
              assignee: null,
              actions: ['task.change_status', 'task.change_assignee'],
            },
          ]}
          events={[
            eventSummary({
              name: '가을 축제',
              startsAt: '2026-10-28T14:00',
              endsAt: '2026-10-30T18:00',
            }),
          ]}
        />
      </div>
    </Section>
  )
}
