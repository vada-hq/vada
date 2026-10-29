// 줄(카드 줄·타일) 전체를 누르는 자리로 만드는 class 묶음. 줄 안 제목 단추 하나의 ::after가 줄 상자를 덮는다
// (Bootstrap stretched link, Material 목록 항목). 화면 읽기와 Tab에는 제목 단추 하나로 남아 줄 안 글을 다시 읽지 않는다.
// 줄 안에 따로 누르는 것이 있으면 그것에 `relative z-10`을 줘 덮개 위로 올린다.

// 줄 상자: 덮개의 기준이고, 휴대폰 폭(640 아래)에서 44px 이상(WCAG 2.5.8, Apple HIG 44pt)이다.
// 키보드 초점 링은 제목 글자가 아니라 누르는 자리인 줄 전체에 그린다.
export const rowLinkBox =
  'relative max-sm:min-h-11 has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-primary-strong'

// 제목 단추: 줄 전체를 덮고, 링은 줄 상자가 그리므로 단추 자신은 그리지 않는다.
export const rowLinkTarget = 'after:absolute after:inset-0 focus-visible:ring-0'

// 카드 머리의 작은 글 링크([모두 보기]·[내역]): 휴대폰에서 누르는 자리만 44px로 키우고, 키운 만큼 음수 바깥 여백으로
// 되돌려 머리 높이와 글자 자리는 그대로 둔다.
export const headLinkTouch = 'max-sm:-my-3 max-sm:min-h-11'
