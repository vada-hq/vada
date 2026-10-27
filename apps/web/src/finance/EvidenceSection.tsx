import type { ExpenseDetail } from '@vada/contracts'
import PhotoThumbs from '@/components/PhotoThumbs'
import StateMessage from '@/components/StateMessage'
import { evidenceFilePath } from './expense-api'
import { EVIDENCE_TYPE_LABEL } from './expense-view'
import { EvidenceAdder } from './EvidenceAdder'
import { MessageEvidence } from './MessageEvidence'
import type { useChatEvidence } from './useChatEvidence'
import type { useEvidenceUpload } from './useEvidenceUpload'
import type { useMessageEvidence } from './useMessageEvidence'

type Props = {
  // 사진 상태는 대화상자가 쥔다(지출을 다시 읽어도 고른 사진이 사라지지 않게).
  councilId: string
  expense: ExpenseDetail
  upload: ReturnType<typeof useEvidenceUpload>
  chat: ReturnType<typeof useChatEvidence>
  // 지출을 적은 메시지의 사진(메시지에서 열었을 때만 있다)
  message: ReturnType<typeof useMessageEvidence>
}

type Hooks = Pick<Props, 'upload' | 'chat' | 'message'>

// 다시 읽은 지출이 취소됐거나 한도에 닿아 붙이는 칸이 사라져도 거절 이유는 남긴다.
function Problems({ attachable, upload, chat, message }: Hooks & { attachable: boolean }) {
  const shown = [upload.problem, attachable ? null : (message.problem ?? chat.problem)]
  return shown.map(
    text =>
      text && (
        <StateMessage key={text} kind="error">
          {text}
        </StateMessage>
      ),
  )
}

// 증빙 사진. 모든 운영진이 보고 누르면 크게 보인다. 붙이는 칸은 서버가 준 동작이 있을 때만 보인다.
export function EvidenceSection({ councilId, expense, upload, chat, message }: Props) {
  const photos = expense.evidence.map((item, index) => ({
    id: item.id,
    src: evidenceFilePath(councilId, expense.id, item.fileId),
    alt: `${EVIDENCE_TYPE_LABEL[item.type]} ${index + 1}`,
  }))
  // 붙이는 칸은 서버가 준 동작이 있을 때만 보인다(재정부, 취소 전, 한도 안, 행사 완료 전).
  const attachable = expense.actions.includes('expense.attach_evidence')
  return (
    <section aria-label="증빙 사진" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">증빙 사진</h3>
      {attachable && <MessageEvidence councilId={councilId} message={message} />}
      {photos.length > 0 && <PhotoThumbs label="증빙 사진 목록" photos={photos} />}
      {photos.length === 0 && !expense.cancelled && (
        <StateMessage kind="empty">증빙 사진 없음</StateMessage>
      )}
      {attachable && <EvidenceAdder councilId={councilId} upload={upload} chat={chat} />}
      <Problems {...{ attachable, upload, chat, message }} />
    </section>
  )
}
