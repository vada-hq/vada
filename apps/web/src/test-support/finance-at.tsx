import type { ComponentProps } from 'react'
import { useHere } from '@/lib/app-location'
import FinancePage from '../finance/FinancePage'
import { COUNCIL_ID } from './workspace-at'

// 주소는 uuid여야 읽히므로 재정 화면 시험은 이 학생회를 쓴다.
export { COUNCIL_ID }

// 작업 공간이 하는 일 하나: 주소가 기록이면 그 기록을 열고 시작하는 새 페이지로 그린다.
// 재정부의 재정 첫 화면은 개요라서, 주소를 정하지 않은 시험은 구매 요청 탭에서 시작한다(첫 화면은 OverviewTab.test가 본다).
export function FinanceAt(props: ComponentProps<typeof FinancePage>) {
  if (window.location.pathname === '/')
    window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=requests`)
  const here = useHere()
  const record = here.location?.type === 'record'
  return <FinancePage key={record || here.released ? here.key : ''} {...props} />
}
