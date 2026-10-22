import { useState, type ReactNode } from 'react'
import type { CouncilView, RegistrationAction, RegistrationForm } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { REGISTRATION_FORMS_LOAD_FAILED } from '@/lib/messages'
import { FormCard } from './FormCard'
import { TabDialogs, type TabDialog } from './TabDialogs'
import { useRegistrationForms } from './useRegistrationForms'

type Props = EventDialogHandlers & {
  view: CouncilView
  eventId: string
}

// 이 화면에서 바꾼 출석(스캐너 포함). 신청자 목록을 다시 읽지 않고(읽을 때마다 열람 기록이 남는다) 이것으로 덮는다.
function useAttendanceOverrides() {
  const [attendance, setAttendance] = useState<ReadonlyMap<string, boolean>>(new Map())
  const markAttended = (id: string, attended: boolean) =>
    setAttendance(before => new Map(before).set(id, attended))
  return { attendance, markAttended }
}

// 열린 대화상자와 이유 글. 대상이 사라졌거나(404) 권한을 잃었으면(403) 대화상자를 닫고 이유를 보이고 양식을 다시 읽는다.
function useTabDialogs(
  onForbidden: () => void,
  reload: () => void,
  markAttended: (id: string, attended: boolean) => void,
) {
  const [dialog, setDialog] = useState<TabDialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const handlers: EventDialogHandlers = {
    onForbidden,
    onLost: message => {
      setDialog(null)
      setNotice(message)
      reload()
    },
  }
  return {
    dialog,
    setDialog,
    notice,
    handlers,
    close: () => setDialog(null),
    saved: () => {
      setDialog(null)
      setNotice(null)
      reload()
    },
    checked: (id: string) => {
      markAttended(id, true)
      reload()
    },
  }
}

// 행사의 '참가 신청' 탭: 신청 양식 카드, 양식 만들기, QR로 출석 확인. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
// 신청자 정보는 열람 권한자에게만 보이고 아니면 신청 수만 보인다.
export function RegistrationTab({ view, eventId, ...parent }: Props) {
  const councilId = view.council.id
  const read = useRegistrationForms(councilId, eventId, parent)
  const reload = () => void read.reload()
  const { attendance, markAttended } = useAttendanceOverrides()
  const tab = useTabDialogs(parent.onForbidden, reload, markAttended)
  const { setDialog, handlers } = tab
  const forms = read.state.kind === 'ready' ? read.state.data.forms : []
  const actions = read.state.kind === 'ready' ? read.state.data.actions : []
  return (
    <div className="flex flex-col gap-3">
      <TabToolbar
        actions={actions}
        onCreate={() => setDialog({ kind: 'create' })}
        onScan={() => setDialog({ kind: 'scan' })}
      />
      {tab.notice && <StateMessage kind="error">{tab.notice}</StateMessage>}
      <FormList state={read.state} onRetry={reload}>
        {form => (
          <FormCard
            key={form.id}
            councilId={councilId}
            form={form}
            attendance={attendance}
            onAttendance={markAttended}
            onEdit={() => setDialog({ kind: 'edit', formId: form.id })}
            onChanged={reload}
            {...handlers}
          />
        )}
      </FormList>
      <TabDialogs
        councilId={councilId}
        eventId={eventId}
        dialog={tab.dialog}
        forms={forms}
        onClose={tab.close}
        onSaved={tab.saved}
        onChecked={tab.checked}
        {...handlers}
      />
    </div>
  )
}

type ToolbarProps = { actions: RegistrationAction[]; onCreate: () => void; onScan: () => void }

// [신청 양식 만들기]와 [QR로 출석 확인]. 서버가 이 행사에서 지금 사람이 할 수 있는 동작을 준다(양식이 없어도).
function TabToolbar({ actions, onCreate, onScan }: ToolbarProps) {
  const manage = actions.includes('registration.manage')
  return (
    <div className="flex flex-wrap gap-2">
      {manage && <Button onClick={onCreate}>신청 양식 만들기</Button>}
      {manage && (
        <Button variant="outline" onClick={onScan}>
          QR로 출석 확인
        </Button>
      )}
    </div>
  )
}

type ListProps = {
  state: ReturnType<typeof useRegistrationForms>['state']
  onRetry: () => void
  children: (form: RegistrationForm) => ReactNode
}

function FormList({ state, onRetry, children }: ListProps) {
  if (state.kind === 'loading') return <StateMessage kind="loading">불러오는 중이에요</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{REGISTRATION_FORMS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
      </div>
    )
  const { forms, truncated } = state.data
  return (
    <>
      {forms.length === 0 && <StateMessage kind="empty">아직 신청 양식이 없어요.</StateMessage>}
      {forms.map(children)}
      {truncated && <StateMessage kind="notice">양식이 많아 앞의 일부만 보여요.</StateMessage>}
    </>
  )
}
