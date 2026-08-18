import { ArrowLeft, ArrowRight, ExternalLink, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { PageCard } from '../components/PageCard'
import { findFlowStep, isBackwardNavigation } from '../spec/flows'
import { navigateTarget, onb02 } from '../spec/screens'
import type { ButtonSpec } from '../spec/types'

interface ONB02ScreenProps {
  onNavigate: (screenId: string) => void
}

// 버튼 아이콘은 스펙에 없어 시각 명세(figma.design.json 14:113 Plus,
// 14:127 ExternalLink)에서 유추해 targetScreenId로 매핑한다(마찰 로그 참조).
const CARD_ICON_BY_TARGET: Record<string, LucideIcon> = {
  'ORG-01': Plus,
  'INV-01': ExternalLink,
}

export function ONB02Screen({ onNavigate }: ONB02ScreenProps) {
  const meta = onb02.meta
  const flowStep = findFlowStep(onb02.screenId)
  const buttons = onb02.elements
    .filter((element) => element.spec.type === 'button')
    .map((element) => element.spec as ButtonSpec)
  // 흐름 순서상 뒤로 가는 버튼은 링크, 나머지는 카드로 그린다(시각 명세의 구분).
  const cardButtons = buttons.filter(
    (button) => !isBackwardNavigation(onb02.screenId, navigateTarget(button.action)),
  )
  const backButtons = buttons.filter((button) =>
    isBackwardNavigation(onb02.screenId, navigateTarget(button.action)),
  )

  return (
    <PageCard>
      {flowStep && (
        <AppHeader label={flowStep.label} step={flowStep.step} totalSteps={flowStep.total} />
      )}

      {meta && <h1 className="pt-6 text-lg font-semibold text-gray-900">{meta.title}</h1>}
      {meta?.description && <p className="pt-1 text-sm text-gray-500">{meta.description}</p>}

      {/* 옵션 카드 14:110: pt 21→24, gap 10.5→12 / 카드 14:111: p 17.5→20, gap 14→16 */}
      <div className="flex flex-col gap-3 pt-6">
        {cardButtons.map((button) => {
          const Icon = CARD_ICON_BY_TARGET[navigateTarget(button.action)]
          return (
            <button
              key={button.label}
              type="button"
              onClick={() => onNavigate(navigateTarget(button.action))}
              className="flex w-full items-center gap-4 rounded-md border border-gray-200 bg-white p-5 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-100">
                {Icon && <Icon className="size-5 text-gray-500" />}
              </span>
              <span className="min-w-0 grow">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{button.label}</span>
                  {button.badge && (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                      {button.badge}
                    </span>
                  )}
                </span>
                {button.description && (
                  <span className="block pt-0.5 text-xs font-medium text-gray-500">
                    {button.description}
                  </span>
                )}
              </span>
              <ArrowRight className="size-4 shrink-0 text-gray-400" />
            </button>
          )
        })}
      </div>

      {/* 안내문 14:142: pt 14→16 */}
      {meta?.footerNote && (
        <p className="pt-4 text-center text-xs text-gray-400">{meta.footerNote}</p>
      )}

      {/* 뒤로 가기 링크 14:146: pt 14→16, px 10.5→12, py 5.25→6, blue-600 */}
      {backButtons.length > 0 && (
        <div className="pt-4">
          {backButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              onClick={() => onNavigate(navigateTarget(button.action))}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
            >
              <ArrowLeft className="size-3.5" />
              {button.label}
            </button>
          ))}
        </div>
      )}
    </PageCard>
  )
}
