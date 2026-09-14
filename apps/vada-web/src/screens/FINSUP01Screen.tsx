import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { SupplementActions } from './purchase-supplement/SupplementActions'
import { SupplementItems } from './purchase-supplement/SupplementItems'
import { SupplementNotice } from './purchase-supplement/SupplementNotice'
import { BREADCRUMB_SEPARATORS, SCREEN } from './purchase-supplement/spec'
import {
  useSupplementDraft,
  type SupplementDraftProps,
} from './purchase-supplement/useSupplementDraft'

// 보완 요청 확인·재제출(FIN-SUP-01). 화면 셸은 데이터·제출 모델과 세 영역을 조립한다.
export function FINSUP01Screen(props: SupplementDraftProps) {
  const model = useSupplementDraft(props)
  const shell = {
    screenId: model.screen.screenId,
    activeNavigationScreenId: model.screen.activeNavigationScreenId,
    eyebrow: model.screen.meta?.eyebrow,
    title: model.screen.meta?.title ?? model.screen.screenId,
  }

  if (!model.ready) {
    return (
      <AppShell {...shell} onNavigate={props.onNavigate}>
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      {...shell}
      onNavigate={props.onNavigate}
      breadcrumb={
        model.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : String(model.breadcrumbRow?.[item.field] ?? ''),
            )}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-8 py-6">
        <SupplementNotice model={model} />
        <SupplementItems model={model} />
        <SupplementActions model={model} />
      </div>
    </AppShell>
  )
}
