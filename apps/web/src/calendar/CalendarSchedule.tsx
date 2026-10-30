import { useState } from 'react'
import { KOREAN_DATE_LENGTH, type CouncilView, type ScheduleItemDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { CALENDAR_LOAD_FAILED } from '@/lib/calendar-messages'
import { ScheduleDetail, ScheduleFrame } from './ScheduleDetail'
import { ScheduleEditor } from './ScheduleEditor'
import { useScheduleRecord } from './useScheduleRecord'

type Editor = { date: string; item?: ScheduleItemDetail }

export function useCalendarSchedule(
  councilId: string,
  selectDay: (day: string) => void,
  onForbidden: () => void,
) {
  const record = useScheduleRecord(councilId, selectDay, onForbidden)
  const [editor, setEditor] = useState<Editor | null>(null)
  return { record, editor, setEditor, selectDay }
}

type Flow = ReturnType<typeof useCalendarSchedule>

// 없는 일정의 까닭. 업무처럼 페이지 맨 위 오류 한 줄이다. 달력 아래에 두면 화면 밖으로 밀린다.
export function ScheduleLost({ flow }: { flow: Flow }) {
  const { notice } = flow.record
  return notice && <StateMessage kind="error">{notice}</StateMessage>
}

export function CalendarSchedule({
  flow,
  view,
  onForbidden,
  onChanged,
}: {
  flow: Flow
  view: CouncilView
  onForbidden: () => void
  onChanged: () => Promise<void>
}) {
  const { record, editor, setEditor } = flow
  const saved = (item: ScheduleItemDetail) => {
    record.replace(item)
    setEditor(null)
    flow.selectDay(item.start.slice(0, KOREAN_DATE_LENGTH))
    void onChanged()
  }
  const cancel = async () => {
    const error = await record.cancel()
    if (!error) void onChanged()
    return error
  }
  return (
    <>
      {record.id &&
        (record.item ? (
          <ScheduleDetail
            councilId={view.council.id}
            item={record.item}
            onClose={record.close}
            onDelete={cancel}
            onEdit={() => setEditor({ date: record.item!.start, item: record.item! })}
          />
        ) : (
          <ScheduleFrame title="일정 상세" id={record.id} onClose={record.close}>
            {record.state.kind === 'failed' ? (
              <>
                <StateMessage kind="error">{CALENDAR_LOAD_FAILED}</StateMessage>
                <Button variant="outline" touch onClick={() => void record.retry()}>
                  다시 시도
                </Button>
              </>
            ) : (
              <StateMessage kind="loading">일정 불러오는 중…</StateMessage>
            )}
          </ScheduleFrame>
        ))}
      {editor && (
        <ScheduleEditor
          view={view}
          initialDate={editor.date}
          item={editor.item}
          onForbidden={onForbidden}
          onSaved={saved}
          onMissing={() => {
            setEditor(null)
            record.missing()
            void onChanged()
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
