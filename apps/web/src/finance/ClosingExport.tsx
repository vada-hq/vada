import { useState } from 'react'
import type { Closing } from '@vada/contracts'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ACTION_GONE } from '@/lib/messages'
import { useDialogGuard } from '@/lib/use-dialog-guard'
import { useClosingExport, type ExportKind } from './closing-export'

const AUDIT_WARNING =
  '이 파일에는 운영진 이름, 계좌번호, 예금주, 영수증 사진이 들어 있어요. 감사에 내는 용도로만 쓰고, 받은 파일은 다른 사람에게 넘기지 않도록 보관해 주세요.'
const PUBLIC_NOTE =
  '공개용 파일에는 이름, 계좌번호, 사진이 없어요. 다만 지출 내용과 사유에 사람이 직접 쓴 이름은 걸러지지 않아요.'
const BUNDLE_TOO_LARGE_NOTE =
  '증빙이 너무 많아서(사진 2,000장이나 1GB 초과) 묶음을 받을 수 없어요. VADA 팀에 부탁해 주세요.'
const WORKBOOK_TOO_LARGE_NOTE =
  '지출이나 수입이 너무 많아서(각 1,000건 초과) 엑셀을 받을 수 없어요. VADA 팀에 부탁해 주세요.'
const NO_STORAGE_NOTE = '지금은 증빙 묶음을 만들 수 없어요. 엑셀은 받을 수 있어요.'

type AuditKind = Exclude<ExportKind, 'public'>
const AUDIT_TITLE: Record<AuditKind, string> = {
  audit: '감사용 엑셀을 받을까요?',
  bundle: '증빙 묶음을 받을까요?',
}

// 버튼을 숨길지와 그 이유는 이 함수 하나다. 엑셀은 줄 수 상한만, 묶음은 사진 수·크기 상한과 파일 저장소 유무도 본다.
// 숨기지 않으면 null이다. 숨긴 이유는 ExportNotes가 보인다.
function blockedReason(closing: Closing, kind: AuditKind) {
  const info = closing.exportInfo
  if (kind === 'audit') return info.workbookTooLarge ? WORKBOOK_TOO_LARGE_NOTE : null
  if (!info.bundleAvailable) return NO_STORAGE_NOTE
  return info.bundleTooLarge ? BUNDLE_TOO_LARGE_NOTE : null
}

type ButtonsProps = {
  closing: Closing
  busy: boolean
  onPublic: () => void
  onAudit: (kind: AuditKind) => void
}

// 공개용은 서버 동작에 있으면(공개 전 재정부, 공개 뒤 모든 운영진), 감사용과 묶음은 재정부 동작에만 보인다.
function ExportButtons({ closing, busy, onPublic, onAudit }: ButtonsProps) {
  const canPublic = closing.actions.includes('closing.export_public')
  const canAudit = closing.actions.includes('closing.export_audit')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPublic && (
        <Button variant="outline" busy={busy} onClick={onPublic}>
          공개용 엑셀
        </Button>
      )}
      {canAudit && blockedReason(closing, 'audit') === null && (
        <Button variant="outline" busy={busy} onClick={() => onAudit('audit')}>
          감사용 엑셀
        </Button>
      )}
      {canAudit && blockedReason(closing, 'bundle') === null && (
        <Button variant="outline" busy={busy} onClick={() => onAudit('bundle')}>
          증빙 묶음 받기
        </Button>
      )}
    </div>
  )
}

function ExportNotes({ closing }: { closing: Closing }) {
  const canAudit = closing.actions.includes('closing.export_audit')
  const reasons = canAudit
    ? (['audit', 'bundle'] as const).map(kind => blockedReason(closing, kind))
    : []
  return (
    <>
      {closing.actions.includes('closing.export_public') && (
        <p className="text-xs text-fg-muted">{PUBLIC_NOTE}</p>
      )}
      {reasons.map(
        reason =>
          reason && (
            <StateMessage key={reason} kind="notice">
              {reason}
            </StateMessage>
          ),
      )}
    </>
  )
}

type Props = { councilId: string; closing: Closing }

// 내보내기. 감사용 엑셀과 묶음은 개인정보 경고를 확인한 뒤 받는다. 상한을 넘으면 그 버튼이 숨고 이유가 보인다.
export function ClosingExport({ councilId, closing }: Props) {
  const exporter = useClosingExport(councilId, closing.period.id)
  const [confirming, setConfirming] = useState<AuditKind | null>(null)
  const [gone, setGone] = useState<string | null>(null)
  const canAudit = closing.actions.includes('closing.export_audit')
  // 받기 확인을 연 동안 감사용 동작이 서버 동작에서 빠지면 닫고 이유를 보인다.
  useDialogGuard(confirming !== null, canAudit ? null : ACTION_GONE, message => {
    setConfirming(null)
    setGone(message)
  })
  const problem = exporter.problem ?? gone
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-fg">내보내기</h3>
      <ExportButtons
        closing={closing}
        busy={exporter.busy}
        onPublic={() => void exporter.start('public')}
        onAudit={kind => {
          setGone(null)
          setConfirming(kind)
        }}
      />
      <ExportNotes closing={closing} />
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
      {confirming && canAudit && (
        <ConfirmDialog
          open
          title={AUDIT_TITLE[confirming]}
          description={AUDIT_WARNING}
          confirmLabel="받기"
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            void exporter.start(confirming)
            setConfirming(null)
          }}
        />
      )}
    </Card>
  )
}
