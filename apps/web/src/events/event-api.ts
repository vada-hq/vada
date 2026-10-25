export const eventsPath = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/events`
// 옆 메뉴의 완료하지 않은 행사
export const sidebarEventsPath = (councilId: string) => `${eventsPath(councilId)}/open`
export const eventPath = (councilId: string, eventId: string) =>
  `${eventsPath(councilId)}/${encodeURIComponent(eventId)}`
