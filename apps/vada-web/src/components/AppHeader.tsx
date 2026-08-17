interface AppHeaderProps {
  step: number
  totalSteps: number
}

// 헤더 7:5: 로고 24.5→28, gap 7→8 / 진행 pill 17.5×5.25→20×6, gap 5.25→6.
// 흐름 단계 정보는 스펙에 없어 화면이 직접 전달한다(마찰 로그 11번).
export function AppHeader({ step, totalSteps }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
          V
        </div>
        <span className="text-base font-semibold text-gray-900">Vada</span>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 w-5 rounded-full ${
              index + 1 === step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
        <span className="pl-1 text-xs text-gray-400">
          기본 설정 {step} / {totalSteps}
        </span>
      </div>
    </header>
  )
}
