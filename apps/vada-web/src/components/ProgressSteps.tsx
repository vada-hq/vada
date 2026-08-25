import { Fragment } from 'react'
import { Check } from 'lucide-react'

interface ProgressStep {
  key: string
  label: string
}

interface ProgressStepsProps {
  /** design 대조가 단계 줄을 찾아가는 끈. */
  nodeId?: string
  items: ProgressStep[]
  currentKey: string
  /** 지난 단계의 체크 그림은 design에만 있는 사실이라 호출부가 지목한다. */
  completedIconNodeId?: string
}

// 업무 흐름 화면의 진행 표시와 다르다. 이것은 화면 위치가 아니라 한 요청의 처리 상태다.
export function ProgressSteps({
  nodeId,
  items,
  currentKey,
  completedIconNodeId,
}: ProgressStepsProps) {
  const currentIndex = items.findIndex((item) => item.key === currentKey)
  if (currentIndex === -1) {
    // 모르는 단계를 첫 단계로 바꾸면 서버와 화면의 절차가 갈린 사실이 숨는다.
    throw new Error(`등록되지 않은 현재 단계입니다: ${currentKey}`)
  }

  return (
    <ol
      data-node-id={nodeId}
      className="flex items-start rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      {items.map((item, index) => {
        const completed = index < currentIndex
        const current = index === currentIndex
        return (
          <Fragment key={item.key}>
            <li data-design-state className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                  completed
                    ? 'bg-blue-600 text-white'
                    : current
                      ? 'bg-yellow-400 text-white'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {completed ? (
                  <Check
                    data-asset-node-id={completedIconNodeId}
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2}
                  />
                ) : (
                  index + 1
                )}
              </span>
              <span
                aria-current={current ? 'step' : undefined}
                className={`text-center text-xs font-semibold ${
                  completed
                    ? 'text-blue-600'
                    : current
                      ? 'text-yellow-600'
                      : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </li>
            {index < items.length - 1 ? (
              <span
                aria-hidden="true"
                className={`mt-3.5 h-px w-8 shrink-0 ${
                  index < currentIndex ? 'bg-blue-300' : 'bg-gray-200'
                }`}
              />
            ) : null}
          </Fragment>
        )
      })}
    </ol>
  )
}
