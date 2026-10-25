import { koreanDateOf } from '@vada/contracts'

// 서버 전체에서 한국 날짜마다 센다. 계정마다의 속도 제한만으로는 계정 하나가 학생회를 여럿 만들어 달 크레딧을 몇 시간에 다 쓸 수 있다.
// 셈은 서버 메모리라 Render 인스턴스가 하나일 때 맞고, 다시 시작하면 0부터다(http/rate-limit.ts와 같은 전제).
export function createDailyCap(limit: number) {
  let day = ''
  let count = 0
  return {
    // 이번 한 번을 센다. 그날 상한에 닿았으면 false이고 세지 않는다.
    take(now: Date) {
      const today = koreanDateOf(now)
      if (today !== day) {
        day = today
        count = 0
      }
      if (count >= limit) return false
      count++
      return true
    },
  }
}
