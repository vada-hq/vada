import { councilPath } from './finance-api'

export const incomesRootPath = (councilId: string) => `${councilPath(councilId)}/incomes`
export const incomesPath = (councilId: string, periodId: string) =>
  `${incomesRootPath(councilId)}?period=${encodeURIComponent(periodId)}`
export const incomePath = (councilId: string, incomeId: string) =>
  `${incomesRootPath(councilId)}/${encodeURIComponent(incomeId)}`
export const incomeCancelPath = (councilId: string, incomeId: string) =>
  `${incomePath(councilId, incomeId)}/cancel`
