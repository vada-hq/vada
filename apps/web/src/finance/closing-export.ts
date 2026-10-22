import { useRef, useState } from 'react'
import { downloadFile, saveByFrame } from '@/lib/download'
import { CLOSING_ERRORS, CLOSING_EXPORT_FAILED } from '@/lib/messages'
import { closingBundlePath, closingExportPath } from './closing-api'

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
    // 묶음은 크므로 메모리에 받지 않고 숨은 iframe으로 받는다. 오류는 같은 길로 읽어 버튼 옆에 보인다.
    const result =
      kind === 'bundle'
        ? await saveByFrame(closingBundlePath(councilId, periodId))
        : await downloadFile(closingExportPath(councilId, periodId, kind), FALLBACK_NAME)
    if (!result.ok) {
      const code = typeof result.code === 'string' ? result.code : ''
      setProblem(CLOSING_ERRORS[code] ?? CLOSING_EXPORT_FAILED)
    }
    sending.current = false
    setBusy(false)
  }

  return { busy, problem, start }
}
