import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'

// 신청 양식의 질문·선택지와 신청의 답(기능 025 조각 21). 기록이 아니다(0027의 까닭).
export const registrationQuestion = pgTable('registration_question', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  formId: uuid('form_id').notNull(),
  position: integer('position').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  required: boolean('required').notNull().default(false),
})

export const registrationQuestionChoice = pgTable('registration_question_choice', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  questionId: uuid('question_id').notNull(),
  formId: uuid('form_id').notNull(),
  position: integer('position').notNull(),
  label: text('label').notNull(),
})

export const registrationAnswer = pgTable('registration_answer', {
  id: uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`),
  registrationId: uuid('registration_id').notNull(),
  questionId: uuid('question_id').notNull(),
  choiceId: uuid('choice_id'),
  textValue: text('text_value'),
})
