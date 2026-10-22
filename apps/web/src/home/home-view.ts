import type { HomeMine, HomeTaskGroup } from '@vada/contracts'

export const GROUP_LABEL: Record<HomeTaskGroup, string> = {
  overdue: '지남',
  today: '오늘',
  soon: '7일 안',
}

// 내 업무가 하나도 없는가. 마감이 먼 것과 마감 없는 것도 있으면 비지 않았다.
export const mineIsEmpty = ({ counts }: HomeMine) =>
  counts.overdue + counts.today + counts.soon + counts.later + counts.noDue === 0
