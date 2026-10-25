import type { HomeResponse } from '@vada/contracts'

// 모든 홈 종류가 받는 칸(기능 027 조각 4). 지금 화면의 부분(기능 010)이 계층대로 오는지 보는 시험은 이것을 빼고 본다.
const COMMON_KEYS = new Set<string>([
  'kind',
  'financeView',
  'asOf',
  'myTasks',
  'featuredEvents',
  'participating',
  'upcoming',
  'myRequests',
] satisfies (keyof HomeResponse)[])

export const sectionKeys = (home: object) =>
  Object.keys(home)
    .filter(key => !COMMON_KEYS.has(key))
    .sort()
