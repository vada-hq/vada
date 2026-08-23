import type { ReactNode } from 'react'
import { AppHeader } from './AppHeader'
import { FlowProgress } from './FlowProgress'
import { findFlowStep } from '../spec/flows'
import { drawsTitle } from '../spec/screens'
import type { ScreenSpec } from '../spec/types'

// 흐름 화면이 담기는 카드. 머리(로고·눈썹·제목·설명·진행 표시)까지 여기가 그린다.
//
// figma.design.json 7:3(양축 중앙 정렬, py 42→48) + 7:4(콘텐츠 448→512,
// padding 35→40, border 1). 카드 총폭 594 = 512 + 40×2 + 1×2 (÷0.875 환산).
// 카드 폭은 화면마다 다르다 — ORG-02(14:242)는 860→982로 더 넓다.
const DEFAULT_MAX_WIDTH = 594

// 머리는 두 형태다. 어느 쪽인지는 화면이 고르지 않고 meta.eyebrow가 말한다.
//
// 눈썹은 '새 학생회 만들기'처럼 **어느 흐름 안에 있는지**를 적는 자리다. 그 흐름
// 이름이 있으면 머리 왼쪽을 그것이 차지하고 로고가 빠진다(ORG-01 14:155,
// ORG-02 14:243). 없으면 로고가 그 자리를 지킨다(ONB-01 7:5, INV-01 14:6).
//
// 짐작이 아니라 관측이다 — 카드형 화면 다섯이 모두 그렇고, design의 로고 유무와
// 어긋나면 design 대조가 실패한다(design-check/screens.design.test.tsx).
interface PageCardProps {
  /** 머리를 그릴 화면. 없으면 카드만 그린다(라우터의 오류 화면). */
  screen?: ScreenSpec
  children: ReactNode
  maxWidth?: number
}

export function PageCard({ screen, children, maxWidth = DEFAULT_MAX_WIDTH }: PageCardProps) {
  const meta = screen?.meta
  const flowStep = screen ? findFlowStep(screen.screenId) : null
  const progress = flowStep && (
    <FlowProgress label={flowStep.label} step={flowStep.step} totalSteps={flowStep.total} />
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <main
        style={{ maxWidth: `${maxWidth}px` }}
        className="w-full rounded-xl border border-gray-200 bg-white p-10 shadow-sm"
      >
        {meta?.eyebrow ? (
          // 제목형: 눈썹+제목이 왼쪽, 진행 표시가 오른쪽.
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-gray-400">{meta.eyebrow}</p>
              <h1 className="pt-1 text-lg font-semibold text-gray-900">{meta.title}</h1>
            </div>
            {progress}
          </header>
        ) : (
          // 로고형: 로고와 진행 표시가 한 줄, 제목이 그 아래(7:18 pt 21→24).
          screen && (
            <>
              <AppHeader
                label={flowStep?.label}
                step={flowStep?.step}
                totalSteps={flowStep?.total}
              />
              {meta && drawsTitle(screen.screenId) && (
                <h1 className="pt-6 text-lg font-semibold text-gray-900">{meta.title}</h1>
              )}
            </>
          )
        )}
        {meta?.description && <p className="pt-1 text-sm text-gray-500">{meta.description}</p>}

        {children}
      </main>
    </div>
  )
}
