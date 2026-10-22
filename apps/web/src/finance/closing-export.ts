import { useRef, useState } from 'react'
import { downloadFile, saveByNavigation } from '@/lib/download'
import { CLOSING_ERRORS, CLOSING_EXPORT_FAILED } from '@/lib/messages'
import { closingBundlePath, closingExportPath } from './closing-api'

// 내보내기 버튼을 보일지의 표시 하나. 서버가 엑셀과 증빙 묶음(기능 009 조각 5)을 주기 전까지 false다.
// 서버가 오르면 true로 바꾼다. 버튼은 서버 동작(closing.export_public·export_audit)에 따라 보이고 아래 길로 바로 받는다.
export const CLOSING_EXPORT_READY = false

const FALLBACK_NAME = '결산.xlsx'

export type ExportKind = 'public' | 'audit' | 'bundle'

// 내보내기 하나. 받는 동안은 다시 누를 수 없고, 거절 문구는 그 버튼 옆에 보인다.
export function useClosingExport(councilId: string, periodId: string) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const sending = useRef(false)

  async function start(kind: ExportKind) {
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setProblem(null)
    if (kind === 'bundle') {
      saveByNavigation(closingBundlePath(councilId, periodId))
    } else {
      const result = await downloadFile(closingExportPath(councilId, periodId, kind), FALLBACK_NAME)
      if (!result.ok) {
        const code = typeof result.code === 'string' ? result.code : ''
        setProblem(CLOSING_ERRORS[code] ?? CLOSING_EXPORT_FAILED)
      }
    }
    sending.current = false
    setBusy(false)
  }

  return { busy, problem, start }
}
