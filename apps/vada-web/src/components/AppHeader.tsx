interface AppHeaderProps {
  label: string
  step: number
  totalSteps: number
}

// 헤더 7:5: 로고 24.5→28, gap 7→8 / 진행 pill 17.5×5.25→20×6, gap 5.25→6.
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
          {label} {step} / {totalSteps}
        </span>
      </div>
    </header>
  )
}
