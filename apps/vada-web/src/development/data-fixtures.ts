// 개발용 응답. 값은 figma.design.json이 그린 예시를 그대로 옮긴 것이라
// 구현 화면과 reference.png를 눈으로 대조할 수 있다. 백엔드가 붙으면
// catalog.ts의 request.path로 대체된다.
import type { DataRow } from '../data-sources/definitions'
import { APPLICATION_DASHBOARD_FIXTURES } from './fixtures/application'
import { ATTENDANCE_FILTERED_FIXTURES } from './fixtures/attendance'
import { CALENDAR_DASHBOARD_FIXTURES, CALENDAR_FILTERED_FIXTURES } from './fixtures/calendar'
import {
  EVENT_DASHBOARD_FIXTURES,
  EVENT_FILTERED_FIXTURES,
  EVENT_TASK_FILTERED_FIXTURES,
} from './fixtures/events'
import { FINANCE_DASHBOARD_FIXTURES, FINANCE_FILTERED_FIXTURES } from './fixtures/finance'
import { HOME_DASHBOARD_FIXTURES } from './fixtures/home'
import {
  MEETING_DASHBOARD_FIXTURES,
  MEETING_FILTERED_FIXTURES,
} from './fixtures/meetings'
import { MESSAGE_DASHBOARD_FIXTURES } from './fixtures/messages'
import { OPERATIONS_DASHBOARD_FIXTURES } from './fixtures/operations'
import {
  ORGANIZATION_DASHBOARD_FIXTURES,
  ORGANIZATION_FILTERED_FIXTURES,
} from './fixtures/organizations'
import { RECORD_DASHBOARD_FIXTURES, RECORD_FILTERED_FIXTURES } from './fixtures/records'
import { SURVEY_FILTERED_FIXTURES } from './fixtures/surveys'
import { TASK_DASHBOARD_FIXTURES } from './fixtures/tasks'

export const DASHBOARD_FIXTURES: Record<string, DataRow | DataRow[]> = {
  ...EVENT_DASHBOARD_FIXTURES,
  ...FINANCE_DASHBOARD_FIXTURES,
  ...RECORD_DASHBOARD_FIXTURES,
  ...CALENDAR_DASHBOARD_FIXTURES,
  ...MEETING_DASHBOARD_FIXTURES,
  ...HOME_DASHBOARD_FIXTURES,
  ...APPLICATION_DASHBOARD_FIXTURES,
  ...TASK_DASHBOARD_FIXTURES,
  ...OPERATIONS_DASHBOARD_FIXTURES,
  ...ORGANIZATION_DASHBOARD_FIXTURES,
  ...MESSAGE_DASHBOARD_FIXTURES,
}

// 인자를 받는 출처. 실제로는 서버가 걸러 주므로 mock도 여기서 거른다 —
// 받아온 것을 화면에서 거르면 명세(itemList.params)와 다른 것을 구현하게 된다.

export const FILTERED_FIXTURES: Record<
  string,
  (params: Record<string, string>) => DataRow[]
> = {
  ...FINANCE_FILTERED_FIXTURES,
  ...EVENT_TASK_FILTERED_FIXTURES,
  ...EVENT_FILTERED_FIXTURES,
  ...ATTENDANCE_FILTERED_FIXTURES,
  ...SURVEY_FILTERED_FIXTURES,
  ...MEETING_FILTERED_FIXTURES,
  ...RECORD_FILTERED_FIXTURES,
  ...ORGANIZATION_FILTERED_FIXTURES,
  ...CALENDAR_FILTERED_FIXTURES,
}
