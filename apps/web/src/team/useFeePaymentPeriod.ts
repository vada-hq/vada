import { useState } from 'react'
import { usePeriods } from '../finance/useIncomes'

export function useFeePaymentPeriod(councilId: string, onForbidden: () => void) {
  const [chosen, select] = useState<string | null>(null)
  const read = usePeriods(councilId, onForbidden)
  const periods = read.state.kind === 'ready' ? read.state.data.periods : []
  const selected =
    chosen ?? periods.find(period => period.current)?.id ?? periods[0]?.id ?? 'manual'
  const period = periods.find(item => item.id === selected)
  return { periods, selected, period, select }
}
