import type { CouncilView } from '@vada/contracts'
import PageColumn from '@/components/PageColumn'
import StateMessage from '@/components/StateMessage'
import { useUnsavedInput } from '@/lib/leave-guard'
import { useMenuQuery } from '@/lib/use-menu-query'
import { AccountsTab } from '@/finance/AccountsTab'
import { SettingsTabs } from './SettingsTabs'
import CohortForm from './CohortForm'
import CouncilInfoForm from './CouncilInfoForm'
import type { Form } from './council-settings-form'
import { useCouncilSettings } from './useCouncilSettings'

type Props = { view: CouncilView; onSaved: (view: CouncilView) => void; onForbidden: () => void }

// 설정 > 학생회 정보: 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간. 회장단만 고치고, 나머지 운영진은 보기만 한다.
export default function CouncilSettings({ view, onSaved, onForbidden }: Props) {
  const settings = useCouncilSettings(view, onSaved, onForbidden)
  const { message, saving } = settings
  useUnsavedInput(settings.dirty)
  const note = (form: Form) =>
    message?.form === form && <StateMessage kind={message.kind}>{message.text}</StateMessage>
  const canCouncil = view.permissions.includes('council.update')
  const query = useMenuQuery('settings', view.council.id)
  const accounts = query.query['section'] === 'accounts'
  return (
    <PageColumn>
      <SettingsTabs
        accounts={accounts}
        onChange={next => query.set({ section: next ? 'accounts' : null })}
      />
      {accounts ? (
        <AccountsTab
          councilId={view.council.id}
          canManage={view.permissions.includes('finance.manage')}
          onForbidden={onForbidden}
        />
      ) : (
        <>
          {!canCouncil && <p className="text-sm text-gray-500">회장단만 고칠 수 있어요.</p>}
          <CouncilInfoForm
            value={settings.council}
            canEdit={canCouncil}
            saving={saving === 'council'}
            busy={saving !== null}
            note={note('council')}
            onEdit={settings.editCouncil}
            onEditTitle={settings.editTitle}
            onSubmit={event => {
              void settings.save(event, 'council')
            }}
          />
          <CohortForm
            value={settings.cohort}
            canEdit={view.permissions.includes('cohort.update')}
            saving={saving === 'cohort'}
            busy={saving !== null}
            note={note('cohort')}
            onEdit={settings.editCohort}
            onSubmit={event => {
              void settings.save(event, 'cohort')
            }}
          />
        </>
      )}
    </PageColumn>
  )
}
