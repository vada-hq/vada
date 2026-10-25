import { Meter } from '@/components/Meter'

type Props = {
  // '업무', '부서 업무'
  label: string
  done: number
  total: number
}

// 행사 카드의 업무 진행 막대(와이어프레임 HomePrototypeProgress): 짧은 막대 옆에 '업무 2/5'.
// 업무 수일 뿐 행사 준비율이 아니라 %로 적지 않는다(DEC-95).
export default function HomeProgress({ label, done, total }: Props) {
  const text = `${label} ${done}/${total}`
  return (
    <div className="flex items-center gap-2">
      {/* 업무가 없으면 progress의 max가 0이 될 수 없어 빈 막대로 그린다. */}
      <Meter value={done} max={Math.max(total, 1)} label={text} className="w-24 shrink-0" />
      <span className="text-xs text-gray-500">
        {label} <strong className="font-semibold text-gray-700">{`${done}/${total}`}</strong>
      </span>
    </div>
  )
}
