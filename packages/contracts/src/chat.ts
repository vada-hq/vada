import { z } from 'zod'
import { text } from './input.js'

export const MESSAGE_CONTENT_MAX = 2000
export const CreateMessageSchema = z.strictObject({ content: text(MESSAGE_CONTENT_MAX) })
export type CreateMessageRequest = z.infer<typeof CreateMessageSchema>
