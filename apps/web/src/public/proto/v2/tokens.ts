// v2 '큰 글자 앱 화면 모양'의 크기·간격·모서리 이름. 색은 index.css 의미 이름만 쓴다(새 색 없음).
// 근거: 토스 TDS TextField·FixedBottomCTA·Result(r06), 토스 송금 완료(r05), Typeform 큰 선택지(r07).
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

// 글자 크기 네 단계(명세 7절: 4개 이하)
export const type = {
  // 행사명·완료 제목·입장 QR 제목 26px
  title: 'text-[26px] leading-[34px] font-bold tracking-[-0.02em]',
  // 입력 글자·선택지·계좌번호·버튼·줄 제목 17px
  body: 'text-[17px] leading-6',
  // 이름표·회색 요약·설명 15px
  label: 'text-[15px] leading-[22px]',
  // 학생회 이름·고지·알약·지우는 날 13px
  small: 'text-[13px] leading-[19px]',
}

export const size = {
  // 채운 칸·선택 줄·주 버튼 높이 56px(TDS TextField·FixedBottomCTA 큰 크기)
  control: 'min-h-14',
  // 완료 체크·상태 아이콘 원 64px
  resultIcon: 'size-16',
  // 입장 QR 줄의 아이콘 원 44px
  rowIcon: 'size-11',
  // 1280에서 가운데 단 폭 520px(휴대폰 앱 화면을 그대로 가운데에)
  column: 'max-w-[520px]',
  // 당일 큰 QR 한 변 248px(390 폭의 약 64%, 의견 규칙 200px 이상)
  qrDay: 'w-62',
  // 시트 안 QR 폭 70%
  qrSheet: 'w-[70%] max-w-72',
  // 640px 이상에서 아래 버튼 자리의 고정을 풀고 흐림 면·위 여백을 뺀다(마지막 칸 뒤 제자리)
  barStatic: 'sm:static sm:bg-none sm:pt-0',
}

export const space = {
  // 화면 옆 여백 24px
  page: 'px-6',
  // 칸 사이 24px(간격으로만 나눈다)
  fields: 'gap-6',
  // 이름표와 칸 사이 8px
  labelGap: 'gap-2',
  // 선택 줄 사이 8px
  choices: 'gap-2',
  // 구역 사이를 가르는 회색 띠 높이 8px(앱의 굵은 구분 띠)
  band: 'h-2',
}

export const radius = {
  // 채운 칸·선택 줄·주 버튼 14px
  control: 'rounded-[14px]',
  // 계좌 면·QR 판 20px
  panel: 'rounded-[20px]',
  // 시트 위 모서리 24px
  sheet: 'rounded-t-[24px]',
}

export const shadow = {
  // 아래 고정 버튼 위로 글이 비치지 않게 흰 면을 위로 24px 흐리게 올린다(그림자 대신)
  barFade: 'bg-linear-to-t from-white from-70% to-white/0',
  // 토스트 그림자(Tailwind shadow-lg)
  toast: 'shadow-lg',
}
