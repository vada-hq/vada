import { PageCard } from '../components/PageCard'
import { onb02 } from '../spec/screens'
import type { ButtonSpec } from '../spec/types'

interface ONB02ScreenProps {
  onNavigate: (screenId: string) => void
}

// ONB-01 파일럿의 자리표시 화면(docs/pilot-onb01.md). ONB-02 자체의 시각 명세는
// 아직 추출하지 않았고, 동작 명세의 버튼 3개 중 뒤로 가기(ONB-01)만 동작한다.
export function ONB02Screen({ onNavigate }: ONB02ScreenProps) {
  const buttons = onb02.elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)

  return (
    <PageCard>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
            V
          </div>
          <span className="text-base font-semibold text-gray-900">Vada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-gray-200" />
          <span className="h-1.5 w-5 rounded-full bg-blue-600" />
          <span className="pl-1 text-xs text-gray-400">기본 설정 2 / 2</span>
        </div>
      </header>

      <h1 className="pt-6 text-lg font-semibold text-gray-900">시작 방식 선택</h1>
      <p className="pt-1 text-sm text-gray-500">
        파일럿 자리표시 화면입니다. 아래 버튼 중 뒤로 가기만 동작합니다.
      </p>

      <div className="flex flex-col gap-3 pt-6">
        {buttons.map((button) =>
          button.action.targetScreenId === 'ONB-01' ? (
            <button
              key={button.label}
              type="button"
              onClick={() => onNavigate(button.action.targetScreenId)}
              className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              {button.label}
            </button>
          ) : (
            <button
              key={button.label}
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded bg-gray-100 px-4 py-2 text-sm text-gray-400"
            >
              {button.label} (파일럿 범위 밖)
            </button>
          ),
        )}
      </div>
    </PageCard>
  )
}
