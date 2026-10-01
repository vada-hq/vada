import type { EventSummary, MembershipSummary, MessageSummary, PurchaseDetail } from '@vada/contracts'
import { draft } from '../purchases/purchase-test-fixtures'

export const user = (finance = false) => ({ id: finance ? 'f' : 'u', name: finance ? '재정 테스터' : '기획 테스터',
  email: finance ? 'finance@example.test' : 'planning@example.test' })
export const membership = (finance = false): MembershipSummary => ({ id: finance ? 'mf' : 'mp',
  organization: { id: 'o', name: '테스트 학생회' },
  department: { id: finance ? 'df' : 'd', name: finance ? '재정부' : '기획부', handlesFinance: finance } })
export const event = (id = 'e'): EventSummary => ({ id, organizationId: 'o', name: id === 'e' ? '체육대회' : '축제',
  createdBy: 'u', createdAt: '2026-09-30T00:00:00Z' })
export const message = (): MessageSummary => ({ id: 'm', chatRoomId: 'room', author: user(),
  content: '테이블 2개 준비', createdAt: event().createdAt })
export const request = (overrides: Partial<PurchaseDetail> = {}): PurchaseDetail => ({ ...draft(), ...overrides })
export const eventsPath = '/api/organizations/o/events'
export const messagesPath = (id = 'e') => `${eventsPath}/${id}/messages`
export const purchasesPath = (id = 'e') => `${eventsPath}/${id}/purchase-requests`
