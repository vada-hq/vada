import { cn } from '@/lib/utils'

const STEPS = ['기본 정보', '조직 구조', '초대 링크'] as const

// 학생회 만들기 단계 머리: 작은 윗글 '학생회 만들기', 제목은 단계 이름, 오른쪽에 'n/3' 진행 표시(와이어프레임 ORG-01·02).
// 단계마다 제목이 달라야 지금 어느 단계인지 한눈에 보인다.
export function CreateStepHeader({ step: name }: { step: (typeof STEPS)[number] }) {
  const step = STEPS.indexOf(name) + 1
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-fg-muted">학생회 만들기</p>
        {/* 단계가 바뀌면 누른 버튼이 사라지므로, 만들기 틀(CreateCouncilForm)이 초점을 이 제목으로 옮긴다. */}
        <h2 tabIndex={-1} className="text-lg font-semibold outline-none">
          {name}
        </h2>
      </div>
      <p className="flex items-center gap-1.5 pt-1 text-xs text-fg-muted">
        <span aria-hidden className="flex gap-1">
          {STEPS.map((label, index) => (
            <span
              key={label}
              className={cn(
                'h-1.5 w-5 rounded-full',
                index < step ? 'bg-primary-emphasis' : 'bg-muted-strong',
              )}
            />
          ))}
        </span>
        {`${step}/${STEPS.length}`}
      </p>
    </div>
  )
}
