import type { EventSummary, MembershipSummary, MessageSummary } from '@vada/contracts'

export const user = (finance = false) => ({ id: finance ? 'f' : 'u', name: finance ? '재정 테스터' : '기획 테스터',
  email: finance ? 'finance@example.test' : 'planning@example.test' })
export const membership = (finance = false): MembershipSummary => ({ id: finance ? 'mf' : 'mp',
  organization: { id: 'o', name: '테스트 학생회', inviteCode: 'ABCD2345' },
  department: { id: finance ? 'df' : 'd', name: finance ? '재정부' : '기획부', handlesFinance: finance, isLeadership: false },
  title: null, permissions: { manageOrganization: false, approvePurchases: finance, manageEvents: true } })
export const event = (id = 'e'): EventSummary => ({ id, organizationId: 'o', name: id === 'e' ? '체육대회' : '축제',
  createdBy: 'u', createdAt: '2026-09-30T00:00:00Z', startsAt: null, endsAt: null, place: null, version: 1 })
export const message = (): MessageSummary => ({ id: 'm', chatRoomId: 'room', author: user(),
  content: '테이블 2개 준비', createdAt: event().createdAt })
export const eventsPath = '/api/organizations/o/events'
export const messagesPath = (id = 'e') => `${eventsPath}/${id}/messages`
export const purchaseItemsPath = (id = 'e') => `${eventsPath}/${id}/purchase-items`
export const candidatesPath = (id = 'e') => `${eventsPath}/${id}/purchase-candidates`
export const reviewPath = '/api/organizations/o/purchase-review'
export const myTasksPath = '/api/organizations/o/my-tasks'
