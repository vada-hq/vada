import { fiscalPeriodsPath } from './finance-api'

export const closingPath = (councilId: string, periodId: string) =>
  `${fiscalPeriodsPath(councilId)}/${encodeURIComponent(periodId)}/closing`
export const closingPublishPath = (councilId: string, periodId: string) =>
  `${closingPath(councilId, periodId)}/publish`
export const closingReopenPath = (councilId: string, periodId: string) =>
  `${closingPath(councilId, periodId)}/reopen`
export const closingExportPath = (councilId: string, periodId: string, type: 'public' | 'audit') =>
  `${closingPath(councilId, periodId)}/export?type=${type}`
export const closingBundlePath = (councilId: string, periodId: string) =>
  `${closingPath(councilId, periodId)}/audit.zip`
