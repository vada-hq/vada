import type { ExpenseDetail } from '@vada/contracts'
import PhotoThumbs from '@/components/PhotoThumbs'
import StateMessage from '@/components/StateMessage'
import { evidenceFilePath } from './expense-api'
import { canAttachEvidence, EVIDENCE_TYPE_LABEL } from './expense-view'
import { EvidenceAdder } from './EvidenceAdder'
import { MessageEvidence } from './MessageEvidence'
import type { useChatEvidence } from './useChatEvidence'
import type { useEvidenceUpload } from './useEvidenceUpload'
import type { useMessageEvidence } from './useMessageEvidence'

type Props = {
  // 사진 상태는 대화상자가 쥔다(지출을 다시 읽어도 고른 사진이 사라지지 않게).
  councilId: string
  expense: ExpenseDetail
  canManage: boolean
  upload: ReturnType<typeof useEvidenceUpload>
  chat: ReturnType<typeof useChatEvidence>
  // 지출을 적은 메시지의 사진(메시지에서 열었을 때만 있다)
  message: ReturnType<typeof useMessageEvidence>
}

// 증빙 사진. 모든 운영진이 보고 누르면 크게 보인다. 붙이는 칸은 재정부에게, 취소되지 않았고 한도 안일 때만 보인다.
export function EvidenceSection({ councilId, expense, canManage, upload, chat, message }: Props) {
  const photos = expense.evidence.map((item, index) => ({
    id: item.id,
    src: evidenceFilePath(councilId, expense.id, item.fileId),
    alt: `${EVIDENCE_TYPE_LABEL[item.type]} ${index + 1}`,
  }))
  const attachable = canAttachEvidence(expense, canManage)
  return (
    <section aria-label="증빙 사진" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">증빙 사진</h3>
      {attachable && <MessageEvidence councilId={councilId} message={message} />}
      {photos.length > 0 && <PhotoThumbs label="증빙 사진 목록" photos={photos} />}
      {photos.length === 0 && !expense.cancelled && (
        <StateMessage kind="empty">
          {canManage ? '영수증이나 이체 확인 사진을 붙여 주세요.' : '아직 붙은 사진이 없어요.'}
        </StateMessage>
      )}
      {attachable && <EvidenceAdder councilId={councilId} upload={upload} chat={chat} />}
      {/* 다시 읽은 지출이 취소됐거나 한도에 닿아 올리기 칸이 사라져도 거절 이유는 남긴다. */}
      {upload.problem && <StateMessage kind="error">{upload.problem}</StateMessage>}
      {!attachable && chat.problem && <StateMessage kind="error">{chat.problem}</StateMessage>}
    </section>
  )
}
