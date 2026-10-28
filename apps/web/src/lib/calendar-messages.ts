// 캘린더(일정 읽기·만들기, 구독)의 문구. 여러 화면이 같이 쓰는 문구는 messages.ts에 있다.
// messages.ts가 파일 길이 상한(300줄)에 닿아 예산 문구(budget-messages.ts)처럼 나눴다.
import { changeErrors } from './change-errors'

export const CALENDAR_FEED_LOAD_FAILED = '구독 상태를 불러오지 못했어요.'
export const CALENDAR_FEED_CREATE_FAILED = '구독 주소를 만들지 못했어요.'
export const CALENDAR_FEED_DELETE_FAILED = '구독을 끊지 못했어요.'
export const CALENDAR_FEED_ERRORS = changeErrors({})
export const CALENDAR_LOAD_FAILED = '일정을 불러오지 못했어요. 연결을 확인해 주세요.'
export const SCHEDULE_NOT_FOUND = '일정 없음'
export const SCHEDULE_DEPARTMENT_FORBIDDEN = '이 부서는 고를 수 없어요.'
