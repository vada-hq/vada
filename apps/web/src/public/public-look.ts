// 공개 신청 화면('큰 글자 앱 화면 모양', 대표 확정 시안 v2)의 글자·크기·모서리. 색은 index.css 의미 이름만 쓴다.
// 근거: 토스 TDS TextField·FixedBottomCTA·Result, 토스 송금 완료, Typeform 큰 선택지(notes/integration/events/form-apply-v2.md).
// 시안 값(26/17/15/13px, 모서리 14·20px)을 Tailwind 스케일과 index.css 글자 단계로 옮겼다. 17/15는 홈 구역의 같은 단계를 쓴다.
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 글자 네 단계: 행사명·완료·입장 QR 24 / 칸·선택지·버튼·계좌번호 17 / 이름표·요약·설명 15 / 학생회·고지·알약 12
export const type = {
  title: 'text-2xl/8 font-bold tracking-tight',
  body: 'text-row-title',
  label: 'text-row-sub',
  small: 'text-xs/5',
}

// 채운 칸·선택 줄·주 버튼의 높이 56px(TDS 큰 크기)
export const control = 'min-h-14 max-sm:min-h-14'

// 채운 칸·선택 줄·주 버튼의 모서리, 계좌 면·QR 판의 모서리
export const radius = { control: 'rounded-2xl', panel: 'rounded-3xl' }

// 키보드 초점 고리. 회색 면 위에서도 보이게 강조색이다.
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-emphasis focus-visible:ring-offset-0'
