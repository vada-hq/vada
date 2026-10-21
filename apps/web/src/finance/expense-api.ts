const base = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}`

export const expensesPath = (councilId: string) => `${base(councilId)}/expenses`
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
// 지출을 적을 때 고르는 예산 항목은 지금 회계 기간의 것이다.
export const budgetPath = (councilId: string) => `${base(councilId)}/budget`
