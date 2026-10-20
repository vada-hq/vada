const LONG_NAME_REPEAT = 2
const UNBROKEN_REPEAT = 12

// 줄바꿈 없는 긴 글이 부품 안에서 어떻게 접히는지 보는 예시 글.
export const longName =
  '2026 소프트웨어융합대학 체육대회 준비와 참가자 명단 확인 그리고 물품 구매 요청 정리를 위한 아주 긴 행사 이름'.repeat(
    LONG_NAME_REPEAT,
  )
export const unbroken = `https://www.coupang.com/vp/products/${'1234567890'.repeat(UNBROKEN_REPEAT)}`
// 카톡 안 로그인 예시용 사용자 에이전트. KakaoBlock에 가짜 주소·가짜 복사와 함께 끼워 넣어, 버튼을 눌러도 이 화면이 넘어가거나 클립보드를 건드리지 않는다.
export const kakaoUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'
