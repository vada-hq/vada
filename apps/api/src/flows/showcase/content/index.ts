import { COUNCIL } from './council.js'
import { FEE_ROSTER, FORMS } from './forms.js'
import { DIRECT_EXPENSES, FINANCE, PURCHASES } from './money.js'
import { MESSAGES } from './talk.js'
import type { ShowcaseContent } from './types.js'
import { EVENTS, MEETINGS, SCHEDULE, TASKS } from './work.js'

// 시연 학생회의 내용 한 벌(원본: 2026-10-30 아침의 '제34대 올웨이즈 학생회'). 다음 미팅 때는 이 폴더의 파일만 고친다.
export const SHOWCASE: ShowcaseContent = {
  council: COUNCIL,
  events: EVENTS,
  tasks: TASKS,
  meetings: MEETINGS,
  schedule: SCHEDULE,
  finance: FINANCE,
  purchases: PURCHASES,
  expenses: DIRECT_EXPENSES,
  messages: MESSAGES,
  feeRoster: FEE_ROSTER,
  forms: FORMS,
}
