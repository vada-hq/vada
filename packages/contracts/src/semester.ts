// 회계 기간 만들기의 기본값(DEC-92, 024 정한 것 11): 그 날(한국)이 든 학기. 1학기 1월 1일~6월 30일, 2학기 7월 1일~12월 31일이다.
// 개강 전 방학에 쓴 돈을 그 학기로 넣는 세칙을 따라 두 학기 사이에 빈 날이 없다. 화면이 채워 두는 값일 뿐 서버는 날짜를 자유로 받는다.
const SECOND_HALF_FROM_MONTH = 7
const YEAR_LENGTH = 4
const MONTH_END = 7

export function semesterOf(day: string) {
  const year = day.slice(0, YEAR_LENGTH)
  const month = Number(day.slice(YEAR_LENGTH + 1, MONTH_END))
  if (month < SECOND_HALF_FROM_MONTH)
    return { name: `${year}년 1학기`, startsOn: `${year}-01-01`, endsOn: `${year}-06-30` }
  return { name: `${year}년 2학기`, startsOn: `${year}-07-01`, endsOn: `${year}-12-31` }
}
