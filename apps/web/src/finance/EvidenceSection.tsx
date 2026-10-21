import type { ExpenseDetail } from '@vada/contracts'
import PhotoThumbs from '@/components/PhotoThumbs'
import StateMessage from '@/components/StateMessage'
import { evidenceFilePath } from './expense-api'
import { canAttachEvidence, EVIDENCE_TYPE_LABEL } from './expense-view'
import { EvidenceAdder } from './EvidenceAdder'
import type { useEvidenceUpload } from './useEvidenceUpload'

type Props = {
  // 사진 상태는 대화상자가 쥔다(지출을 다시 읽어도 고른 사진이 사라지지 않게).
  councilId: string
  expense: ExpenseDetail
  canManage: boolean
  upload: ReturnType<typeof useEvidenceUpload>
}

// 증빙 사진. 모든 운영진이 보고 누르면 크게 보인다. 붙이는 칸은 재정부에게, 취소되지 않았고 한도 안일 때만 보인다.
export function EvidenceSection({ councilId, expense, canManage, upload }: Props) {
  const photos = expense.evidence.map((item, index) => ({
    id: item.id,
    src: evidenceFilePath(councilId, expense.id, item.fileId),
    alt: `${EVIDENCE_TYPE_LABEL[item.type]} ${index + 1}`,
  }))
  const attachable = canAttachEvidence(expense, canManage)
  return (
    <section aria-label="증빙 사진" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">증빙 사진</h3>
      {photos.length > 0 && <PhotoThumbs label="증빙 사진 목록" photos={photos} />}
      {photos.length === 0 && !expense.cancelled && (
        <StateMessage kind="empty">
          {canManage ? '영수증이나 이체 확인 사진을 붙여 주세요.' : '아직 붙은 사진이 없어요.'}
        </StateMessage>
      )}
      {attachable && <EvidenceAdder upload={upload} />}
    </section>
  )
}
