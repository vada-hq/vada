import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { RECEIPTS_PER_EXPENSE_MAX, type CreateReceiptUploadRequest, type ExpenseDetail, type ReceiptUploadResponse } from '@vada/contracts'
import { expenseReceipts as receipts } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'
import { detailOf, lockExpense, recordExpense, type ExpenseDatabase, type ExpenseScope, type ExpenseTransaction } from './service.js'
import type { ReceiptStorage } from './storage.js'

type Receipt = typeof receipts.$inferSelect
async function readyCount(tx: ExpenseTransaction, expenseId: string) {
  const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(receipts)
    .where(and(eq(receipts.expenseId, expenseId), eq(receipts.status, 'ready')))
  return row!.count
}

// 영수증은 브라우저가 서명 주소로 저장소에 바로 올린다. 서버는 행을 만들고, 올라간 파일을 확인하고, 보기 주소를 준다.
export function createReceiptService(db: ExpenseDatabase, storage?: ReceiptStorage) {
  const store = () => {
    if (!storage) throw new ApiError('STORAGE_NOT_CONFIGURED', 503)
    return storage
  }
  async function find(scope: ExpenseScope, expenseId: string, receiptId: string, ready: boolean) {
    const [row] = await db.select().from(receipts).where(and(eq(receipts.organizationId, scope.organizationId),
      eq(receipts.expenseId, expenseId), eq(receipts.id, receiptId), ...(ready ? [eq(receipts.status, 'ready')] : [])))
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  // 확인에 실패한 파일은 저장소와 DB에서 지운다. 저장소 삭제가 실패해도 행은 지운다.
  async function discard(bucket: ReceiptStorage, receipt: Receipt) {
    await bucket.remove(receipt.objectKey).catch(() => console.error('RECEIPT_DELETE_FAILED'))
    await db.delete(receipts).where(and(eq(receipts.id, receipt.id), eq(receipts.status, 'pending')))
  }
  return {
    async createUpload(scope: ExpenseScope, expenseId: string, input: CreateReceiptUploadRequest): Promise<ReceiptUploadResponse> {
      const bucket = store()
      const created = await db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        const expense = await lockExpense(tx, scope, expenseId)
        if (expense.voidedAt) throw new ApiError('INVALID_STATE', 409)
        if (await readyCount(tx, expenseId) >= RECEIPTS_PER_EXPENSE_MAX) throw new ApiError('RECEIPT_LIMIT', 409)
        const id = randomUUID()
        // 저장 경로는 서버가 정한다. 파일 이름은 경로에 쓰지 않는다.
        const objectKey = `receipts/${scope.organizationId}/${expenseId}/${id}`
        await tx.insert(receipts).values({ id, organizationId: scope.organizationId, expenseId, objectKey, fileName: input.fileName,
          contentType: input.contentType, sizeBytes: input.size, kind: input.kind, uploadedBy: scope.userId })
        return { id, objectKey }
      })
      const upload = await bucket.uploadUrl(created.objectKey, input.contentType)
      return { receiptId: created.id, upload: { url: upload.url, headers: upload.headers }, expiresAt: upload.expiresAt.toISOString() }
    },
    // 올라간 파일의 크기·형식이 신고와 같아야 증빙으로 받는다. 같은 확인을 다시 보내면 그대로 돌려준다.
    async confirm(scope: ExpenseScope, expenseId: string, receiptId: string): Promise<ExpenseDetail> {
      const bucket = store()
      await requireFinance(db, scope)
      const receipt = await find(scope, expenseId, receiptId, false)
      if (receipt.status === 'ready') return detailOf(db, scope, expenseId)
      const stored = await bucket.head(receipt.objectKey)
      const type = stored?.contentType?.split(';')[0]?.trim().toLowerCase()
      if (!stored || stored.size !== receipt.sizeBytes || type !== receipt.contentType) {
        await discard(bucket, receipt)
        throw new ApiError('UPLOAD_MISMATCH', 400)
      }
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        const expense = await lockExpense(tx, scope, expenseId)
        if (expense.voidedAt) throw new ApiError('INVALID_STATE', 409)
        if (await readyCount(tx, expenseId) >= RECEIPTS_PER_EXPENSE_MAX) throw new ApiError('RECEIPT_LIMIT', 409)
        const [updated] = await tx.update(receipts).set({ status: 'ready', confirmedAt: sql`now()` })
          .where(and(eq(receipts.id, receiptId), eq(receipts.status, 'pending'))).returning({ id: receipts.id })
        if (updated) await recordExpense(tx, scope, expenseId, 'receipt_added', { fileName: receipt.fileName, kind: receipt.kind })
        return detailOf(tx, scope, expenseId)
      })
    },
    async remove(scope: ExpenseScope, expenseId: string, receiptId: string): Promise<ExpenseDetail> {
      const bucket = store()
      const removed = await db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        const expense = await lockExpense(tx, scope, expenseId)
        if (expense.voidedAt) throw new ApiError('INVALID_STATE', 409)
        const [row] = await tx.delete(receipts).where(and(eq(receipts.organizationId, scope.organizationId), eq(receipts.expenseId, expenseId),
          eq(receipts.id, receiptId), eq(receipts.status, 'ready'))).returning()
        if (!row) throw new ApiError('NOT_FOUND', 404)
        await recordExpense(tx, scope, expenseId, 'receipt_removed', { fileName: row.fileName, kind: row.kind })
        return { detail: await detailOf(tx, scope, expenseId), objectKey: row.objectKey }
      })
      await bucket.remove(removed.objectKey).catch(() => console.error('RECEIPT_DELETE_FAILED'))
      return removed.detail
    },
    // 학생회 구성원 누구나 연다. 짧게 사는 서명 주소로 보낸다.
    async fileUrl(scope: ExpenseScope, expenseId: string, receiptId: string): Promise<string> {
      const bucket = store()
      const receipt = await find(scope, expenseId, receiptId, true)
      return bucket.downloadUrl(receipt.objectKey, receipt.fileName, receipt.contentType)
    },
  }
}
