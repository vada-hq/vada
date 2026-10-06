import { z } from 'zod'
import { text } from './input.js'

export const EVENT_NAME_MAX = 100
export const CreateEventSchema = z.strictObject({ name: text(EVENT_NAME_MAX) })
export type CreateEventRequest = z.infer<typeof CreateEventSchema>
