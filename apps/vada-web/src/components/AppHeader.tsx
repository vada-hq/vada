import { FlowProgress } from './FlowProgress'

interface AppHeaderProps {
  // 흐름에 속하지 않는 화면(INV-01)은 진행 표시가 없다 — design의 사실이다.
  label?: string
  step?: number
  totalSteps?: number
}

// 헤더 7:5: 로고 24.5→28, gap 7→8. 진행 표시는 FlowProgress가 담당한다.
// 흐름 라벨·단계는 flows.json 카탈로그에서 온다(마찰 로그 11 해소).
export function AppHeader({ label, step, totalSteps }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
          V
        </div>
        <span className="text-base font-semibold text-gray-900">Vada</span>
      </div>
      {label !== undefined && step !== undefined && totalSteps !== undefined && (
        <FlowProgress label={label} step={step} totalSteps={totalSteps} />
      )}
    </header>
  )
}
