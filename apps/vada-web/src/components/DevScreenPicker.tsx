import { useState } from 'react'
import { ALL_SCREENS } from '../spec/screens'
import flowsJson from '../../../../specs/figma/vada-wireframe/flows.json'

// 개발용 화면 목록. 화면 C를 보려고 A·B를 거치지 않게 한다.
//
// 화면 목록을 따로 선언하지 않는다 — 이미 등록된 명세(ALL_SCREENS)와 흐름
// 카탈로그(flows.json)에서 나온다. 제목도 각 화면의 meta가 갖는다.
//
// 이 컴포넌트는 개발 빌드에만 들어간다(App이 import.meta.env.DEV로 가른다).

interface Flow {
  key: string
  screens: Array<{ screenId: string; label: string }>
}

const flows = (flowsJson as { flows: Flow[] }).flows

// 어떤 흐름의 몇 번째 단계인지. 흐름에 없는 화면은 단독으로 열리는 화면이다.
function stepOf(screenId: string): string | null {
  for (const flow of flows) {
    const index = flow.screens.findIndex((step) => step.screenId === screenId)
    if (index >= 0) {
      return `${flow.key} ${index + 1}/${flow.screens.length}`
    }
  }
  return null
}

interface DevScreenPickerProps {
  screenId: string
  onNavigate: (screenId: string) => void
}

export function DevScreenPicker({ screenId, onNavigate }: DevScreenPickerProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="개발용 화면 목록 (배포 빌드에는 없습니다)"
        className="fixed right-4 bottom-4 z-50 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-700"
      >
        화면 {screenId}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/20 p-4">
      <div className="max-h-[80vh] w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">화면 목록</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-gray-500">
          주소로도 열립니다 — <code className="text-gray-700">#/TASK-01</code>
        </p>

        <ul className="p-2">
          {ALL_SCREENS.map((screen) => {
            const step = stepOf(screen.screenId)
            const current = screen.screenId === screenId
            return (
              <li key={screen.screenId}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(screen.screenId)
                    setOpen(false)
                  }}
                  className={`w-full rounded px-3 py-2 text-left ${
                    current ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-gray-500">
                      {screen.screenId}
                    </span>
                    <span className="text-sm text-gray-900">
                      {screen.meta?.title ?? ''}
                    </span>
                  </span>
                  {step === null ? null : (
                    <span className="block pt-0.5 text-[11px] text-gray-400">{step}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <p className="border-t border-gray-200 px-4 py-3 text-[11px] text-gray-400">
          흐름 중간 화면은 앞 단계의 입력값이 비어 있을 수 있습니다. 값이 필요한
          검토는 처음부터 밟아 주세요.
        </p>
      </div>
    </div>
  )
}
