import type { ComponentProps } from 'react'
import { useHere } from '@/lib/app-location'
import FinancePage from '../finance/FinancePage'
import PurchasesPage from '../purchases/PurchasesPage'
import { COUNCIL_ID } from './workspace-at'

// 주소는 uuid여야 읽히므로 재정 화면 시험은 이 학생회를 쓴다.
export { COUNCIL_ID }

// 작업 공간이 하는 일 하나: 주소가 기록이면 그 기록을 열고 시작하는 새 페이지로 그린다.
// 재정은 개요, 구매는 내 요청을 기본으로 열고, 기록 주소에서도 실제 메뉴를 고른다.
export function FinanceAt(props: ComponentProps<typeof FinancePage>) {
  if (window.location.pathname === '/')
    window.history.replaceState(null, '', `/finance/${COUNCIL_ID}`)
  const here = useHere()
  const record = here.location?.type === 'record'
  const Page =
    here.location?.type === 'record'
      ? here.location.record === 'purchases'
        ? PurchasesPage
        : FinancePage
      : here.location?.menu === 'purchases'
        ? PurchasesPage
        : FinancePage
  return <Page key={record || here.released ? here.key : ''} {...props} />
}

export function PurchasesAt(props: ComponentProps<typeof PurchasesPage>) {
  if (window.location.pathname === '/')
    window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}`)
  return <FinanceAt {...props} />
}
