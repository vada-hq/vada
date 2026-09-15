import type { ReactNode } from 'react'
import { msg02 } from '../../spec/screen-specs/msg02'
import { MSG01Screen } from '../MSG01Screen'

interface MessageRoomModalProps {
  onClose: () => void
  children: ReactNode
}

// 명세의 overlay가 가리키는 MSG-01을 뒤에 두고 새 방 카드를 겹쳐 그린다.
export function MessageRoomModal({ onClose, children }: MessageRoomModalProps) {
  return (
    <>
      <div aria-hidden className="pointer-events-none">
        <MSG01Screen onNavigate={() => undefined} />
      </div>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={msg02.meta?.title ?? msg02.screenId}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {children}
        </div>
      </div>
    </>
  )
}
