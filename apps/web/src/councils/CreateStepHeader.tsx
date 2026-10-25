import { cn } from '@/lib/utils'

const STEPS = ['기본 정보', '조직 구조', '초대 링크'] as const

// 학생회 만들기 단계 머리: 제목과 '기본 정보 1/3' 같은 진행 표시(와이어프레임 ORG-01·02).
export function CreateStepHeader({ step: name }: { step: (typeof STEPS)[number] }) {
  const step = STEPS.indexOf(name) + 1
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 className="text-lg font-semibold">학생회 만들기</h2>
      <p className="flex items-center gap-1.5 pt-1 text-xs text-gray-500">
        <span aria-hidden className="flex gap-1">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={cn('h-1.5 w-5 rounded-full', index < step ? 'bg-blue-600' : 'bg-gray-200')}
            />
          ))}
        </span>
        {`${name} ${step}/${STEPS.length}`}
      </p>
    </div>
  )
}
