// v3 '티켓 모양'의 색·크기·간격·모서리 이름. 색은 index.css 의미 이름만 쓴다(새 hex 없음).
// 근거: 멜론티켓(r10, 색 면 + 절취선 입장권), Luma(r08, 행사 색 머리), Apple 지갑(r13, 이름표 + 값 칸), 대한항공(r12, '오늘' 깃발).
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 색 역할. 행사 색 = 범주 색 7(남색). 머리 띠·주 버튼·당일 입장권 위 칸이 같은 색이다(티켓의 '행사 색').
export const color = {
  // 행사 색 면(흰 글자 대비 8.1:1)
  event: 'bg-category-7-strong',
  eventText: 'text-category-7-strong',
  // 신청 직후(당일 아님) 입장권 위 칸: 옅은 행사 색(진한 글자 대비 6.5:1). 당일에만 진한 면으로 앞세운다.
  eventSoft: 'bg-category-7-soft',
  // 회색 쟁반(페이지 바탕). 입장권의 반원 홈도 이 색이라 바탕이 비쳐 보인다.
  tray: 'bg-surface-muted',
  // 색 면 위 글자: 흰색 85%(대비 6.3:1), 이름표 75%(5.2:1)
  onEvent: 'text-white',
  onEventSoft: 'text-white/85',
  onEventLabel: 'text-white/75',
  // 쟁반 위 작은 글자는 fg-tertiary(대비 7.0:1). fg-muted는 쟁반 위에서 4.4:1이라 흰 면에만 쓴다.
  trayText: 'text-fg-tertiary',
}

// 글자 크기 네 단계(명세 7절: 4개 이하): 24 / 16 / 14 / 12
export const type = {
  // 행사명(머리 띠)·신청 완료·받지 않을 때 제목·내 참가비 금액 24px
  title: 'text-2xl leading-8 font-bold tracking-tight',
  // 입력 글자·선택지·계좌번호·입장권 행사명·주 버튼 16px
  body: 'text-base leading-6',
  // 이름표·정보 줄·설명 14px
  label: 'text-sm leading-5',
  // 학생회 이름·마감 알약·고지·입장권 이름표·지우는 날 12px
  small: 'text-xs leading-[18px]',
}

export const size = {
  // 1280에서 가운데 단 폭 560px(휴대폰 화면을 넓힌 정도)
  column: 'sm:max-w-[560px]',
  // 글 칸·고르기 줄 높이 48px
  control: 'min-h-12',
  // 주 버튼 높이 52px
  button: 'h-13',
  // 작은 버튼(복사·주소 복사·신청 취소) 높이 44px
  smallButton: 'min-h-11',
  // 머리 띠 정보 줄 아이콘 16px
  infoIcon: 'size-4',
  // 완료 체크·받지 않을 때 아이콘 원 40px / 56px
  doneIcon: 'size-10',
  stateIcon: 'size-14',
  // 입장 QR 한 변: 카드 안쪽 폭의 66%(390에서 약 210px, 의견 규칙 200px 이상), 당일 72%
  qr: 'w-[66%] max-w-60',
  qrDay: 'w-[72%] max-w-72',
  // 입장권 반원 홈 지름 24px
  notch: 'size-6',
}

export const space = {
  // 화면 옆 여백 20px
  page: 'px-5',
  // 머리 띠 아래 시트가 겹쳐 올라오는 깊이 24px
  overlap: '-mt-6',
  // 칸 사이 20px
  fields: 'gap-5',
  // 1280 위 여백
  top: 'sm:pt-10',
}

export const radius = {
  // 1280에서 머리 띠 위 모서리 28px
  band: 'sm:rounded-t-[28px]',
  // 겹쳐 올라온 흰 시트 위 모서리 20px
  sheet: 'rounded-t-[20px]',
  // 글 칸·고르기 줄·주 버튼 12px
  control: 'rounded-xl',
  // 입장권·입금 띠 16px
  card: 'rounded-2xl',
}
