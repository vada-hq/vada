export interface CalendarFeedResponse {
  feed: { createdAt: string } | null
}

export interface CreatedCalendarFeedResponse {
  feed: { createdAt: string }
  url: string
}
