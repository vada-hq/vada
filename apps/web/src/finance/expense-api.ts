import { councilPath } from './finance-api'

export const expensesPath = (councilId: string) => `${councilPath(councilId)}/expenses`
export const expensePath = (councilId: string, expenseId: string) =>
  `${expensesPath(councilId)}/${encodeURIComponent(expenseId)}`
export const expenseCancelPath = (councilId: string, expenseId: string) =>
  `${expensePath(councilId, expenseId)}/cancel`
export const expenseReimbursePath = (councilId: string, expenseId: string) =>
  `${expensePath(councilId, expenseId)}/reimburse`
// 올리기 주소 받기와 붙이기는 재정부, 사진 보기는 모든 운영진이다. 보기는 서명 주소로 302한다.
export const evidenceUploadsPath = (councilId: string, expenseId: string) =>
  `${expensePath(councilId, expenseId)}/uploads`
export const evidencePath = (councilId: string, expenseId: string) =>
  `${expensePath(councilId, expenseId)}/evidence`
export const evidenceFilePath = (councilId: string, expenseId: string, fileId: string) =>
  `${expensePath(councilId, expenseId)}/files/${encodeURIComponent(fileId)}`
