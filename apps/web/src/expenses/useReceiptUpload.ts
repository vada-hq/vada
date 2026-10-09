import { useState } from 'react'
import { CreateReceiptUploadSchema, RECEIPT_FILE_NAME_MAX, RECEIPT_SIZE_MAX, type ExpenseDetail, type ReceiptKind,
  type ReceiptUploadResponse } from '@vada/contracts'
import { expenseFailure, expenseMessage, fitFileName } from './expense-view'
import { expensesBase, sendExpense } from './useExpenses'

export type UploadState = { name: string; status: 'uploading' | 'done' | 'failed'; message?: string }
const invalidFile = `사진(JPG·PNG·WEBP·HEIC)이나 PDF만, ${RECEIPT_SIZE_MAX / 1024 / 1024}MB까지 올릴 수 있어요.`

// 파일마다 서명 주소 받기 → 저장소에 바로 올리기 → 확인 순서로 올린다. 하나가 실패해도 다음 파일을 올린다.
export function useReceiptUpload(organizationId: string, expenseId: string, onUploaded: (expense: ExpenseDetail) => void) {
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [busy, setBusy] = useState(false)
  const base = `${expensesBase(organizationId)}/${encodeURIComponent(expenseId)}/receipts`
  const mark = (index: number, next: Partial<UploadState>) => setUploads(list => list.map((entry, n) => n === index ? { ...entry, ...next } : entry))
  async function uploadOne(file: File, kind: ReceiptKind, index: number) {
    const input = { fileName: fitFileName(file.name, RECEIPT_FILE_NAME_MAX), contentType: file.type, size: file.size, kind }
    if (!CreateReceiptUploadSchema.safeParse(input).success) { mark(index, { status: 'failed', message: invalidFile }); return }
    try {
      const response = await fetch(base, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input) })
      const started = await response.json().catch(() => null) as (Partial<ReceiptUploadResponse> & { error?: unknown }) | null
      if (!response.ok || !started?.receiptId || !started.upload) { mark(index, { status: 'failed', message: expenseMessage(started?.error) }); return }
      // 저장소에는 쿠키 없이 서명 주소와 서명한 헤더만 보낸다.
      const put = await fetch(started.upload.url, { method: 'PUT', headers: started.upload.headers, body: file, credentials: 'omit' })
      if (!put.ok) { mark(index, { status: 'failed', message: '파일을 올리지 못했어요. 다시 시도해 주세요.' }); return }
      const confirmed = await sendExpense(`${base}/${encodeURIComponent(started.receiptId)}/confirm`, 'POST', {})
      if (!confirmed.ok) { mark(index, { status: 'failed', message: confirmed.message }); return }
      mark(index, { status: 'done' })
      onUploaded(confirmed.expense)
    } catch {
      mark(index, { status: 'failed', message: expenseFailure })
    }
  }
  async function upload(files: File[], kind: ReceiptKind) {
    if (!files.length) return
    setBusy(true)
    setUploads(files.map(file => ({ name: file.name, status: 'uploading' })))
    try {
      for (const [index, file] of files.entries()) await uploadOne(file, kind, index)
    } finally {
      setBusy(false)
    }
  }
  return { uploads, busy, upload }
}
