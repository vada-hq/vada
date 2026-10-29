// 행사 참가자 명단('문서 속 얇은 표 모양', 대표 확정 10/30 v1 refined)의 글자·크기·열 폭. 색은 index.css 의미 이름만 쓴다.
// 근거: Carbon 데이터 표 줄 40px, Linear 거르기 문장, Luma 수 붙은 상태 탭, Shopify 표 → 줄 목록(notes/integration/events/form-applicants-v1.md).
// 시안 값(18/14/13/12px)을 Tailwind 스케일로 옮겼다(13px 단계는 없어 12px로 둔다). 종이는 위 양식 카드와 같은 doc-look `sheet`다.
// Tailwind가 글을 읽어 CSS를 만들므로 값은 완성된 클래스 글로 둔다.

export const listType = {
  title: 'text-lg font-semibold tracking-tight',
  body: 'text-sm',
  // 점 + 글 상태, 확인 필요 까닭, 학번, 쪽
  small: 'text-xs/5',
  // 열 이름 줄
  label: 'text-xs font-medium',
  num: 'tabular-nums',
}

export const listSize = {
  // 줄 높이 40px, 열 이름 줄 36px
  row: 'h-10',
  headRow: 'h-9',
  // 체크·아이콘 버튼: 데스크탑 32px, 터치 44px
  hit: 'size-8 pointer-coarse:size-11',
  text: 'min-h-8 pointer-coarse:min-h-11',
}

// 1280 열 폭. 이름 열이 남는 폭을 다 쓴다.
export const col = {
  check: 'w-8',
  studentId: 'w-28',
  affiliation: 'w-32',
  form: 'w-32',
  registration: 'w-22',
  deposit: 'w-48',
  attendance: 'w-20',
  more: 'w-12',
}

// 종이 안 왼쪽·오른쪽 여백(위 양식 카드 px-4 sm:px-8과 같은 세로선)
export const sheetX = 'px-4 sm:px-8'
