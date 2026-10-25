import type { ComponentProps } from 'react'
import { useHere } from '@/lib/app-location'
import FinancePage from '../finance/FinancePage'

// 주소는 uuid여야 읽히므로 재정 화면 시험은 이 학생회를 쓴다.
export { COUNCIL_ID } from './workspace-at'

// 작업 공간이 하는 일 하나: 주소가 기록이면 그 기록을 열고 시작하는 새 페이지로 그린다.
export function FinanceAt(props: ComponentProps<typeof FinancePage>) {
  const here = useHere()
  const record = here.location?.type === 'record'
  return <FinancePage key={record || here.released ? here.key : ''} {...props} />
}
