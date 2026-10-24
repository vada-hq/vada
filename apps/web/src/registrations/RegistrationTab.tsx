import { useState, type ReactNode } from 'react'
import type {
  ApplicantChange,
  CouncilView,
  EventDetail,
  FormListAction,
  RegistrationForm,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventFieldFocus } from '@/events/EventFields'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { PERMISSION_CHANGED } from '@/lib/messages'
import {
  REGISTRATION_FORMS_LOAD_FAILED,
  REGISTRATION_STAFF_LOST,
} from '@/lib/registration-messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { FormCard } from './FormCard'
import { FormCreated } from './FormCreated'
import { FormEditor } from './FormEditor'
import { TabDialogs, type TabDialog } from './TabDialogs'
import { useRegistrationForms } from './useRegistrationForms'

type Props = EventDialogHandlers & {
  view: CouncilView
  eventId: string
  // 양식 화면의 행사 정보와 미리보기에 쓴다. 읽기 전이면 null이다.
  event: EventDetail | null
  // 양식 화면에서 빈 일시·장소를 넣는다(행사 머리의 고치기).
  onEditEvent: (focus: EventFieldFocus) => void
}

type Read = { forms: RegistrationForm[]; actions: FormListAction[] }

// QR 출석은 양식 중 하나라도 form.check_in이 있을 때 쓴다(양식을 아직 못 읽었으면 없다).
const canScan = (forms: RegistrationForm[]) =>
  forms.some(form => form.actions.includes('form.check_in'))

// 열려 있는 동안 15초 읽기가 바꾼 값: 그 대화상자의 쓰기 동작이 빠졌거나 고치던 양식이 사라졌으면 닫을 이유다. 읽기 전(null)에는 없다.
// 만들기는 목록의 form.create, 고치기는 그 양식의 form.update, QR 출석은 양식의 form.check_in이다.
function dialogLostReason(dialog: TabDialog, read: Read | null) {
  if (dialog === null || read === null) return null
  if (dialog.kind === 'create')
    return read.actions.includes('form.create') ? null : PERMISSION_CHANGED
  if (dialog.kind === 'scan') return canScan(read.forms) ? null : PERMISSION_CHANGED
  const form = read.forms.find(item => item.id === dialog.formId)
  if (!form) return REGISTRATION_STAFF_LOST
  return form.actions.includes('form.update') ? null : PERMISSION_CHANGED
}

// 이 화면에서 한 쓰기(스캐너 포함)가 돌려준 줄의 새 모습. 신청자 목록을 다시 읽지 않고(읽을 때마다 열람 기록이 남는다) 이것으로 덮는다.
// 목록을 서버에서 새로 읽으면 그 신청들의 값은 서버 값이 더 새롭다(다른 운영진이 바꿨을 수 있다).
function useRowChanges() {
  const [changes, setChanges] = useState<ReadonlyMap<string, ApplicantChange>>(new Map())
  const apply = (change: ApplicantChange) =>
    setChanges(before => new Map(before).set(change.id, change))
  const forget = (ids: string[]) =>
    setChanges(before => {
      const next = new Map(before)
      for (const id of ids) next.delete(id)
      return next
    })
  return { changes, apply, forget }
}

// 열린 대화상자와 이유 글. 대상이 사라졌거나(404) 권한을 잃었으면(403) 대화상자를 닫고 이유를 보이고 양식을 다시 읽는다.
function useTabDialogs(
  onForbidden: () => void,
  reload: () => void,
  apply: (change: ApplicantChange) => void,
) {
  const [dialog, setDialog] = useState<TabDialog>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // 방금 만든 양식. 목록 대신 링크와 QR을 보인다.
  const [created, setCreated] = useState<RegistrationForm | null>(null)
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
    created,
    close: () => setDialog(null),
    saved: (form: RegistrationForm) => {
      if (dialog?.kind === 'create') setCreated(form)
      setDialog(null)
      setNotice(null)
      reload()
    },
    closeCreated: () => setCreated(null),
    checked: (change: ApplicantChange) => {
      apply(change)
      reload()
    },
  }
}

type Tab = ReturnType<typeof useTabDialogs>
type FormsRead = ReturnType<typeof useRegistrationForms>

// 양식 만들기·고치기 화면. 고치는 동안 양식이 사라졌으면(다시 읽은 목록에 없다) 열지 않는다. 가드가 닫고 이유를 보인다.
function EditorScreen({
  props,
  tab,
  forms,
}: {
  props: Props
  tab: Tab
  forms: RegistrationForm[]
}) {
  const editing = tab.dialog?.kind === 'edit' ? tab.dialog.formId : null
  const form = forms.find(item => item.id === editing)
  if (editing !== null && !form) return null
  return (
    <FormEditor
      councilId={props.view.council.id}
      councilName={props.view.council.name}
      eventId={props.eventId}
      event={props.event}
      {...(form && { form })}
      onEditEvent={props.onEditEvent}
      onClose={tab.close}
      onDone={tab.saved}
      {...tab.handlers}
    />
  )
}

// 양식 목록: 도구 줄, 이유 글, 양식 카드, QR 스캐너.
type ViewProps = {
  props: Props
  tab: Tab
  read: FormsRead
  ready: Read | null
  rows: ReturnType<typeof useRowChanges>
}

function FormsView({ props, tab, read, ready, rows }: ViewProps) {
  const councilId = props.view.council.id
  const { setDialog, handlers } = tab
  const reload = () => void read.reload()
  return (
    <div className="flex flex-col gap-3">
      <TabToolbar
        actions={ready?.actions ?? []}
        scannable={canScan(ready?.forms ?? [])}
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
            changes={rows.changes}
            onChange={rows.apply}
            onLoaded={rows.forget}
            onEdit={() => setDialog({ kind: 'edit', formId: form.id })}
            onChanged={reload}
            {...handlers}
          />
        )}
      </FormList>
      <TabDialogs
        councilId={councilId}
        eventId={props.eventId}
        dialog={tab.dialog}
        onClose={tab.close}
        onChecked={tab.checked}
        {...handlers}
      />
    </div>
  )
}

// 행사의 '참가 신청' 탭: 신청 양식 카드, 양식 만들기(탭 안 화면), QR로 출석 확인. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
// 신청자 정보는 열람 권한자에게만 보이고 아니면 신청 수만 보인다. 양식을 만든 바로 뒤에는 링크와 QR을 보인다.
export function RegistrationTab(props: Props) {
  const { view, eventId, event: _event, onEditEvent: _edit, ...parent } = props
  const read = useRegistrationForms(view.council.id, eventId, parent)
  const rows = useRowChanges()
  const tab = useTabDialogs(parent.onForbidden, () => void read.reload(), rows.apply)
  const ready = read.state.kind === 'ready' ? read.state.data : null
  useDialogGuard(tab.dialog !== null, dialogLostReason(tab.dialog, ready), tab.handlers.onLost)
  if (tab.dialog?.kind === 'create' || tab.dialog?.kind === 'edit')
    return <EditorScreen props={props} tab={tab} forms={ready?.forms ?? []} />
  if (tab.created) return <FormCreated form={tab.created} onDone={tab.closeCreated} />
  return <FormsView props={props} tab={tab} read={read} ready={ready} rows={rows} />
}

type ToolbarProps = {
  actions: FormListAction[]
  scannable: boolean
  onCreate: () => void
  onScan: () => void
}

// [신청 양식 만들기](목록의 form.create)와 [QR로 출석 확인](양식의 form.check_in). 서버가 지금 사람이 할 수 있는 동작을 준다.
function TabToolbar({ actions, scannable, onCreate, onScan }: ToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes('form.create') && <Button onClick={onCreate}>신청 양식 만들기</Button>}
      {scannable && (
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
      {forms.length === 0 && <StateMessage kind="empty">신청 양식 없음</StateMessage>}
      {forms.map(children)}
      {truncated && <StateMessage kind="notice">양식이 많아 앞의 일부만 보여요.</StateMessage>}
    </>
  )
}
