import PageHeading from '@/components/PageHeading'
import { TabButton } from '@/components/ui/tab-button'
import { settingsTrail } from '@/workspace/pages'

const COUNCIL_LABEL = '학생회 정보'
const ACCOUNTS_LABEL = '계좌'

export function SettingsTabs({
  accounts,
  onChange,
}: {
  accounts: boolean
  onChange: (accounts: boolean) => void
}) {
  return (
    <>
      <PageHeading trail={settingsTrail(accounts ? ACCOUNTS_LABEL : COUNCIL_LABEL)}>
        {null}
      </PageHeading>
      <div role="tablist" aria-label="설정 보기" className="flex flex-wrap border-b">
        <TabButton
          className="max-sm:min-h-11"
          aria-selected={!accounts}
          onClick={() => onChange(false)}
        >
          {COUNCIL_LABEL}
        </TabButton>
        <TabButton
          className="max-sm:min-h-11"
          aria-selected={accounts}
          onClick={() => onChange(true)}
        >
          {ACCOUNTS_LABEL}
        </TabButton>
      </div>
    </>
  )
}
