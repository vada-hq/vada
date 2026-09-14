import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { SurveyBasics } from './survey-editor/SurveyBasics'
import { SurveyConditions } from './survey-editor/SurveyConditions'
import { SurveyEditorHeaderAction, SurveyWorkspaceActions } from './survey-editor/SurveyEditorHeader'
import { SurveyQuestions } from './survey-editor/SurveyQuestions'
import { SurveyRecruitment } from './survey-editor/SurveyRecruitment'
import { ASSET, BREADCRUMB_SEPARATORS, NODE, SCREEN, buttonAt } from './survey-editor/survey-spec'
import { useSurveyEditor, type SurveyEditorProps } from './survey-editor/useSurveyEditor'

// 참여 설문 생성·관리. 네 편집 영역과 제출 상태를 배치한다.
export function EVT05Screen(props: SurveyEditorProps) {
  const model = useSurveyEditor(props)
  if (!model.ready) {
    return (
      <AppShell
        screenId={model.screen.screenId}
        activeNavigationScreenId={model.screen.activeNavigationScreenId}
        eyebrow={model.screen.meta?.eyebrow}
        title={model.screen.meta?.title ?? model.screen.screenId}
        onNavigate={model.onNavigate}
      >
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {model.message}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell
      screenId={model.screen.screenId}
      activeNavigationScreenId={model.screen.activeNavigationScreenId}
      eyebrow={model.screen.meta?.eyebrow}
      title={model.title}
      onNavigate={model.onNavigate}
      breadcrumb={
        model.screen.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={model.screen.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={model.breadcrumbItems}
          />
        )
      }
      headerAction={<SurveyEditorHeaderAction model={model} />}
    >
      <WorkspaceHeader
        screen={model.screen}
        screenParams={model.screenParams}
        onNavigate={model.onNavigate}
        onPending={model.setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={<SurveyWorkspaceActions model={model} />}
      />

      {model.note === null ? null : (
        <p role="alert" className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {model.note}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-start gap-4 pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <SurveyBasics
            basicsRow={model.basicsRow}
            onEdit={model.press(buttonAt(NODE.basicsLink))}
          />
          <SurveyRecruitment
            values={model.draft.values}
            onChangeValue={model.setFieldValue}
          />
          <SurveyConditions
            conditionGroups={model.conditionGroups}
            activationRow={model.activationRow}
            screenParams={model.screenParams}
            onNavigate={model.onNavigate}
          />
          <SurveyQuestions
            questionRows={model.questionRows}
            onRemove={model.removeQuestion}
            values={model.draft.values}
            onChangeValue={model.setFieldValue}
          />
        </div>
        <aside className="w-60 shrink-0 self-stretch rounded-md border border-gray-200 bg-white">
          <div data-node-id={NODE.questionPanel} className="border-b border-gray-100 px-3.5 py-2.5">
            <h3 className="text-sm font-semibold text-gray-800">{model.panel.title}</h3>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
