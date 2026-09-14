import type { ReactNode } from 'react'
import { evt02b } from '../../spec/screens'
import { EVT02Screen } from '../EVT02Screen'

interface EventBasicsPanelProps {
  screenParams: Record<string, string>
  onClose: () => void
  children: ReactNode
}

/** 행사 개요를 배경으로 유지하고 편집 대화상자를 겹친다. */
export function EventBasicsPanel({ screenParams, onClose, children }: EventBasicsPanelProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <EVT02Screen screenParams={screenParams} onNavigate={() => undefined} />
      </div>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={evt02b.meta?.title ?? evt02b.screenId}
          onClick={(event) => event.stopPropagation()}
          className="flex h-full w-full max-w-[440px] flex-col border-l border-gray-200 bg-white shadow-2xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
