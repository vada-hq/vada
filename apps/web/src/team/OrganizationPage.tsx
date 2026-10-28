import type { ComponentProps } from 'react'
import PageColumn from '@/components/PageColumn'
import PageHeading from '@/components/PageHeading'
import { peopleTrail } from '@/workspace/pages'
import Organization from './Organization'
import { FeePaymentsTab } from './FeePaymentsTab'
import { OrganizationTabs, PEOPLE_TAB_LABELS } from './OrganizationTabs'
import { useOrganizationControls } from './useOrganizationQuery'

export default function OrganizationPage(props: ComponentProps<typeof Organization>) {
  const { view, onCouncilChanged } = props
  const showFees = view.permissions.includes('fee_payment.view')
  const { tab, setTab } = useOrganizationControls(view.council.id, showFees)
  return (
    <PageColumn>
      <PageHeading trail={peopleTrail(showFees ? PEOPLE_TAB_LABELS[tab] : null)}>
        {null}
      </PageHeading>
      {showFees && <OrganizationTabs tab={tab} onTab={setTab} />}
      <div role={showFees ? 'tabpanel' : undefined} className="flex flex-col gap-3">
        {tab === 'fees' ? (
          <FeePaymentsTab
            councilId={view.council.id}
            canManage={view.permissions.includes('fee_payment.manage')}
            onForbidden={onCouncilChanged}
          />
        ) : (
          <Organization {...props} />
        )}
      </div>
    </PageColumn>
  )
}
