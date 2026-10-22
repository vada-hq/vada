export const eventsPath = (councilId: string) =>
  `/api/organizations/${encodeURIComponent(councilId)}/events`
export const eventPath = (councilId: string, eventId: string) =>
  `${eventsPath(councilId)}/${encodeURIComponent(eventId)}`
