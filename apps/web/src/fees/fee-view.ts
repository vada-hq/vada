import { DUES_ROSTER_USE_DAYS_MAX, type DuesMember } from '@vada/contracts'
import { addDays } from '../purchases/purchase-view'
import type { RosterProblemReason } from './roster-paste'

// 쓰는 기한의 기본값: 이번 학기 끝날. 3~8월은 그해 8월 31일, 9~12월은 다음 해 2월 말일, 1~2월은 그해 2월 말일이다.
export function semesterEnd(today: string) {
  const [year = 0, month = 1] = today.split('-').map(Number)
  if (month >= 3 && month <= 8) return `${year}-08-31`
  const februaryYear = month >= 9 ? year + 1 : year
  // 3월 0일은 2월 말일이다.
  const lastDay = new Date(Date.UTC(februaryYear, 2, 0)).getUTCDate()
  return `${februaryYear}-02-${String(lastDay).padStart(2, '0')}`
}
// 쓰는 기한은 오늘부터 366일 뒤까지다. 서버도 같은 범위를 본다.
export const useUntilRange = (today: string) => ({ min: today, max: addDays(today, DUES_ROSTER_USE_DAYS_MAX) })

// 이름 일부나 학번 일부로 찾는다. 학번의 하이픈·공백은 무시한다. 많이 맞으면 앞에서 limit명까지만 준다.
export function findMembers(members: DuesMember[], query: string, limit = 50) {
  const text = query.trim()
  if (!text) return { shown: [] as DuesMember[], more: false }
  const number = text.replace(/[\s-]/g, '')
  const matched = members.filter(member => member.name.includes(text) || (/^\d+$/.test(number) && member.studentId.includes(number)))
  return { shown: matched.slice(0, limit), more: matched.length > limit }
}

// 붙여 넣기 미리 보기의 줄 문제
export const problemText: Record<RosterProblemReason, string> = {
  shape: '학번과 이름 두 칸만 넣어 주세요',
  studentId: '학번 형식이 아니에요',
  name: '이름을 확인해 주세요',
  conflict: '같은 학번에 이름이 달라요',
}

const messages: Record<string, string> = {
  VERSION_CONFLICT: '다른 사람이 먼저 바꿨어요. 새로 불러온 내용을 확인해 주세요.',
  USE_UNTIL_INVALID: '쓰는 기한은 오늘부터 1년 안의 날짜로 골라 주세요.',
  FORBIDDEN: '재정 담당자만 참가비 설정을 바꿀 수 있어요.',
  BODY_TOO_LARGE: '명단이 너무 커요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
}
export const feeSettingsMessage = (code: unknown) =>
  (typeof code === 'string' && messages[code]) || '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
export const feeSettingsFailure = '연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
