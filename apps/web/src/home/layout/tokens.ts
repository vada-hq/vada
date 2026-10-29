// 배치 시안의 임의 값 모음(구역 폴더의 tokens.ts와 같은 방식). Tailwind가 글자를 읽으므로 클래스는 통째로 적는다.

// 구역 사이 간격: 390 16px, 넓으면 24px
export const STACK = 'flex flex-col gap-4 @2xl:gap-6'
// 두 단이 되는 본문 폭(1280의 본문 977은 두 단, 1024의 721은 한 단)
// 두 단(L2): 오른쪽 단 358px(휴대폰 구역 폭, ③⑤가 시험된 가장 좁은 폭) → 왼쪽 단 595px. 280px로 두면 ①이 두 칸 줄(@2xl = 672px 이상)로
// 펼쳐지지만 ⑤ 제목이 말줄임으로 잘리고 사용 가능 글이 세로로 꺾여(1회차 확인) 358로 정했다. 그래서 왼쪽 ①은 390 꼴(쌓기)이다.
export const TWO_COLS =
  'grid gap-4 @2xl:gap-6 @min-[56rem]:grid-cols-[minmax(0,1fr)_22.375rem] @min-[56rem]:items-start'
// 섞기(L3) 아래 줄: 오른쪽 단 383px(구분선 1 + 여백 24 + 내용 358 = 휴대폰 구역 폭) | 왼쪽 단 나머지
export const MIXED_COLS =
  'grid gap-y-4 @2xl:gap-y-6 @min-[56rem]:grid-cols-[minmax(0,1fr)_23.9375rem] @min-[56rem]:items-start'
export const MIXED_LEFT = '@min-[56rem]:pr-6'
export const MIXED_RIGHT =
  '@min-[56rem]:self-stretch @min-[56rem]:border-l @min-[56rem]:border-border @min-[56rem]:pl-6'

// ① 초점 tray: ①의 쟁반만 한 단계 진하게(gray-100 → gray-200). 0건 띠에는 걸지 않는다.
export const FOCUS_TRAY = '[&>section]:bg-border'

// 구역 머리 글자 크기 차이(size): ①② 20px(구역 그대로) / ③ 17px / ⑤ 15px(구역 그대로)
export const HEAD_MID =
  '[&>section>div:first-child>h2]:text-[17px] [&>section>div:first-child>h2]:leading-[24px] [&>section>div:first-child>span:last-child]:text-[17px] [&>section>div:first-child>span:last-child]:leading-[24px]'

// 얇은 구분(line)
export const RULE = 'h-px shrink-0 bg-border'

// 머리 한 줄: 왼쪽 끝을 구역 머리 글(쟁반 머리 여백)에 맞춘다
export const HEAD = 'flex min-w-0 flex-wrap items-baseline gap-x-2 px-4.5 @2xl:px-5.5'
export const HEAD_TEXT = 'text-[15px] leading-[22px]'
