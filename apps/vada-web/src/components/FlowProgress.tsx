interface FlowProgressProps {
  label: string
  step: number
  totalSteps: number
}

// 진행 pill 17.5×5.25→20×6, gap 5.25→6, 라벨 10.5→12(text-xs) gray-400.
// 완료한 단계까지 채운다(ONB-02 reference: 2/2에서 pill 두 개 모두 파랑).
// 화면 헤더의 좌측 구성(로고 또는 제목)은 화면마다 달라 각 화면이 조립한다.
export function FlowProgress({ label, step, totalSteps }: FlowProgressProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-5 rounded-full ${
            index + 1 <= step ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        />
      ))}
      <span className="pl-1 text-xs text-gray-400">
        {label} {step} / {totalSteps}
      </span>
    </div>
  )
}
