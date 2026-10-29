// v1 종이 한 장 모양의 크기·간격·모서리·그림자·새 색. 이 폴더 안에서만 쓴다.
// 색은 index.css의 의미 이름을 먼저 쓰고, 없는 색만 여기에 hex로 두어 인라인 style로 칠한다.
// Tailwind 클래스(임의 값 포함)도 여기 문자열로 둔다. Tailwind가 이 파일을 읽어 CSS를 만든다.

// 새 색(의미 토큰에 없음)
export const HEX = {
  // 종이 아래 책상 바탕: 옅은 따뜻한 회색. 흰 종이가 떠 보이게 한다(r01·r04의 옅은 바탕).
  desk: '#f1efea',
} as const

// 그림자: 아주 옅게 한 겹 + 머리카락 테두리(큰 그림자는 '피할 느낌')
export const SHADOW = {
  paper: '0 1px 2px rgba(16, 24, 40, 0.06), 0 0 0 1px rgba(16, 24, 40, 0.05)',
  toast: '0 4px 12px rgba(16, 24, 40, 0.18)',
} as const

// QR 한 변(px). 평소 200(390 폭의 약 51%), 행사 당일 248(약 64%, 맨 위로 올라와 커진다).
export const QR_PX = { normal: 200, day: 248 } as const

// 복사 알림이 떠 있는 시간(ms)
export const TOAST_MS = 2200

export const CLS = {
  // 책상: 390에서 좌우 12px만 남기고, 1280에서는 위아래 40px
  desk: 'min-h-dvh px-3 py-3 sm:px-6 sm:py-10',
  // 종이 한 장: 모서리 6px, 1280에서 폭 560px 가운데
  paper: 'mx-auto w-full max-w-[560px] overflow-hidden rounded-[6px] bg-white',
  // 종이 윗변 강조색 띠 7px(r01)
  band: 'h-[7px] bg-primary-emphasis',
  // 종이 안 좌우 여백
  pad: 'px-5 sm:px-8',
  // 테두리 사각 칸: 높이 48px, 모서리 4px, 1px 진한 회색 선(r02)
  field:
    'h-12 rounded-[4px] border-border-strong px-3 text-base sm:text-base focus-visible:border-primary-emphasis',
  // 고르기 줄: 테두리 없이 가는 선으로 나눈 줄, 높이 48px
  choiceList: 'divide-y divide-border-default border-y border-border-default',
  choiceRow: 'flex min-h-12 cursor-pointer items-center gap-3 py-2 text-base text-fg-body',
  // 주 버튼: 종이 안 꽉 찬 폭, 높이 52px, 모서리 6px
  primary: 'h-[52px] w-full rounded-[6px] text-base font-semibold max-sm:min-h-[52px]',
  // 글자 버튼(복사·주소 복사·신청 취소): 테두리 없이 글자만, 누름 상자 44px
  textButton: 'h-11 rounded-[4px] px-2 text-sm font-semibold max-sm:min-h-11',
  // 영수증 줄 사이 점선
  dashedList: 'divide-y divide-dashed divide-border-strong',
  // 영수증 가로 절취 점선(2px)
  perforation: 'border-t-2 border-dashed border-border-strong',
  // 도장 칸: 2px 진한 테두리 사각, 모서리 4px
  stamp: 'relative rounded-[4px] border-2 border-fg bg-white',
  // 도장 칸 윗변에 걸친 이름표
  stampTab:
    'absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-2 text-sm leading-6 font-semibold whitespace-nowrap text-fg',
  // 복사 알림
  toast:
    'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[8px] bg-surface-inverse px-4 py-3 text-sm whitespace-nowrap text-white',
} as const
