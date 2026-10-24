// 결산 공개 잠금(DEC-70)의 판단은 policy/locks.ts 한 곳에 있다. 지출·수입 호출부(기능 014까지)가 이 경로로 부른다.
export { assertDayOpen, isDayClosed, isPeriodClosed } from '../policy/locks.js'
