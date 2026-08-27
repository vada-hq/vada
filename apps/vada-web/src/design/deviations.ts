import type { Deviation } from '../design-check'

// 일부러 design과 다르게 하기로 한 자리.
//
// 와이어프레임은 불규칙할 수 있다. 손으로 그린 것이라 같은 종류의 것이 자리마다
// 조금씩 다르게 칠해진다. 하지만 구현이 그 불규칙을 그대로 옮기면, 다음 화면을
// 만들 때마다 규칙이 아니라 와이어프레임을 들여다봐야 한다. 그래서 규칙을 따르고,
// 그래서 생긴 차이를 여기 적는다.
//
// **어긋난 것을 숨기는 것과, 어긋나기로 한 것을 적어 두는 것은 다른 일이다.**
// 적지 않고 대조에서 빼면 진짜 실수가 났을 때 같이 묻힌다.
//
// 그리고 **이 목록은 화면이 늘어도 늘지 않아야 한다.** 예전에는 자리마다 한 줄씩
// 적었고, 그래서 상태 칩이 있는 화면을 하나 만들 때마다 줄이 늘었다 — 화면당 손
// 작업을 없애려고 만든 체계 안에 화면당 손 작업을 만든 셈이었다. 지금은 규칙이나
// 색에 걸어 두므로, 늘어나는 것은 `by: 'place'`뿐이고 그것은 규칙이 아니라
// 와이어프레임의 일회성 사고에만 쓴다.
//
// 여기 적는 design·screen 값은 대조 검사가 뱉은 줄을 그대로 옮긴 것이다. 그리고
// 더는 어긋나지 않게 되면(design이 고쳐지면) 검사가 "쓰이지 않는 예외"로 알려 준다.

export const DEVIATIONS: Deviation[] = [
  // --- 규칙에 건다: 화면이 몇이든 한 줄 ---------------------------------------
  {
    by: 'rule',
    rule: 'status-chip',
    kind: '색',
    design: 'red-700(#C10007)',
    screen: 'red-800(#9F0712)',
    why:
      '상태 칩 글씨는 톤의 -800으로 통일한다(design/tones.ts의 STATUS_CHIP). ' +
      '와이어프레임은 지연·담당자 없음만 -700이다. 상태가 하나 늘 때 무슨 색을 줄지 ' +
      '규칙만 보고 정할 수 있어야 한다.',
  },
  {
    by: 'rule',
    rule: 'value-text',
    kind: '색',
    design: 'red-500(#FB2C36)',
    screen: 'red-600(#E7000B)',
    why:
      '값 타일의 숫자는 톤의 -600으로 통일한다(design/tones.ts의 VALUE_TEXT). ' +
      '와이어프레임은 red만 -500이다.',
  },

  {
    by: 'rule',
    rule: 'state-chip',
    kind: '색',
    design: 'red-800(#9F0712)',
    screen: 'red-700(#C10007)',
    why:
      '상태 딱지 글씨는 톤의 -700으로 통일한다(design/tones.ts의 STATE_CHIP). ' +
      '와이어프레임은 EVT-TASK-01의 주의 딱지만 -800이고, 같은 자리의 기획 중 딱지는 ' +
      '-700이다. 같은 종류의 딱지가 나란히 다른 규칙을 따를 이유가 없다.',
  },

  {
    by: 'rule',
    rule: 'soft-box-value',
    kind: '색',
    design: 'blue-700(#1447E6)',
    screen: 'blue-800(#193CB8)',
    why:
      '옅은 상자 안의 값은 톤의 -800으로 통일한다(design/tones.ts의 SOFT_BOX_TEXT). ' +
      '와이어프레임은 같은 화면에서 통계 타일은 -800으로, 강조 카드는 -700으로 그렸다. ' +
      '같은 종류의 값이 카드냐 타일이냐로 갈릴 이유가 없다.',
  },
  {
    by: 'rule',
    rule: 'soft-box-value',
    kind: '색',
    design: 'red-700(#C10007)',
    screen: 'red-800(#9F0712)',
    why: '위와 같다(EVT-02 20:4823).',
  },

  {
    by: 'rule',
    rule: 'choice-chip',
    kind: '배경',
    design: 'gray-800(#1E2939)',
    screen: 'blue-600(#155DFC)',
    why:
      '좁혀 보기 칩에서 고른 것은 blue-600이다(design/tones.ts의 CHOICE_CHIP). ' +
      '와이어프레임은 EVT-00A·EVT-SCHED-01이 blue-600이고 EVT-DOC-01만 gray-800이다. ' +
      '필터를 하나 더 만들 때 무슨 색을 줄지 와이어프레임을 열어 보지 않아야 한다.',
  },
  {
    by: 'rule',
    rule: 'choice-chip',
    kind: '테두리',
    design: 'gray-800(#1E2939)',
    screen: 'blue-600(#155DFC)',
    why: '위와 같다 — 고른 칩은 바탕과 테두리가 같은 색이다.',
  },
  {
    by: 'rule',
    rule: 'choice-chip',
    kind: '색',
    design: 'gray-500(#6A7282)',
    screen: 'gray-600(#4A5565)',
    why:
      '좁혀 보기 칩에서 고르지 않은 것의 글씨는 gray-600이다(CHOICE_CHIP). ' +
      '와이어프레임은 EVT-DOC-01·EVT-SCHED-01이 gray-600이고 EVT-00A만 gray-500이다.',
  },

  {
    by: 'rule',
    rule: 'choice-group',
    kind: '배경',
    design: 'gray-800(#1E2939)',
    screen: 'blue-50(#EFF6FF)',
    why:
      '펼친 선택지에서 고른 것은 blue-50 바탕이다(components/ChoiceGroup). ' +
      '와이어프레임은 ORG-01·ORG-02가 blue-50이고 FIN-REQ-01의 견적서 확보 상태만 ' +
      'gray-800이다. 같은 컨트롤이 화면마다 다른 색으로 골라질 이유가 없다.',
  },
  {
    by: 'rule',
    rule: 'choice-group',
    kind: '테두리',
    design: 'gray-800(#1E2939)',
    screen: 'blue-500(#2B7FFF)',
    why: '위와 같다 — 고른 것의 테두리는 blue-500이다.',
  },
  {
    by: 'rule',
    rule: 'choice-group',
    kind: '색',
    design: 'white(#FFFFFF)',
    screen: 'blue-700(#1447E6)',
    why: '위와 같다 — 바탕이 옅으므로 글씨는 blue-700이다.',
  },
  {
    by: 'rule',
    rule: 'choice-group',
    kind: '색',
    design: 'gray-500(#6A7282)',
    screen: 'gray-600(#4A5565)',
    why:
      '고르지 않은 선택지의 글씨는 gray-600이다. 와이어프레임은 ORG-01이 gray-600이고 ' +
      'FIN-REQ-01만 gray-500이다.',
  },

  // --- 색에 건다: 그 색이 어디에 또 쓰였든 한 줄 -------------------------------
  //
  // 와이어프레임에 Tailwind 팔레트에 없는 색이 둘 있다. 팔레트 밖 색을 쓰면 그
  // 색만 이름이 없어 어디에 또 쓰였는지 알 길이 없다.
  {
    by: 'color',
    kind: '색',
    design: '#EF4444',
    screen: 'red-500(#FB2C36)',
    why: '팔레트 밖 색이다(옛 Tailwind red-500). 가장 가까운 red-500을 쓴다.',
  },
  {
    by: 'color',
    kind: '색',
    design: '#0A1F44',
    screen: 'blue-950(#162456)',
    why:
      '팔레트 밖 색이다. 같은 쓰임(강조 상자의 제목)인 OPS-00 16:596이 blue-950이므로 ' +
      '거기에 맞춘다 — 숫자로는 sky-950이 더 가깝지만 색 계열이 다르다.',
  },

  // --- 자리에 건다: 규칙이 아니라 와이어프레임의 일회성 사고 --------------------
  //
  // 와이어프레임이 '기획 중' 딱지를 첫 줄은 파랗게, 다음 줄은 회색으로 그렸다.
  // 같은 상태가 줄에 따라 달라 보이면 읽는 사람이 뜻을 잘못 읽는다.
  {
    by: 'place',
    screenId: 'HOME-01K',
    content: '기획 중',
    kind: '색',
    design: 'gray-500(#6A7282)',
    screen: 'blue-700(#1447E6)',
    why: '같은 상태는 같은 색이다. 와이어프레임이 같은 딱지를 두 줄에 다르게 칠했다.',
  },
  {
    by: 'place',
    screenId: 'HOME-01K',
    content: '기획 중',
    kind: '배경',
    design: 'gray-100(#F3F4F6)',
    screen: 'blue-50(#EFF6FF)',
    why: '같은 상태는 같은 색이다. 와이어프레임이 같은 딱지를 두 줄에 다르게 칠했다.',
  },

  // --- 자리에 건다: 자산 단위 규칙의 결함 -------------------------------------
  //
  // 아이콘 셋(달력·장소·주최자)이 583×7짜리 한 덩이로 뽑혔다. 사이에 글이 없으면
  // 나란한 아이콘들이 한 자산이 되는 규칙 때문이다(BACKLOG — OPS-00 16:615에 이어
  // 두 번째다). 한 덩이라 카드 안 세 자리에 나눠 그릴 수 없다.
  //
  // 같은 아이콘들이 다른 카드에서는 따로 뽑혀 있어 화면은 그것을 그린다. 추출기가
  // 고쳐지거나 이 화면을 다시 저장하면 이 예외가 쓰이지 않게 되고, 그때 검사가
  // 지우라고 알려 준다.

  // --- ORG-03B: 와이어프레임 두 장이 같은 조직을 다르게 그렸다 ---------------
  //
  // ORG-03A와 ORG-03B는 같은 조직도를 보기·수정으로 나눠 그린 것인데, 부서에 든
  // 사람이 서로 다르다. 개발용 응답은 하나이므로 둘 다 맞출 수 없다.
  //
  // **ORG-03A를 따른다.** ORG-03B가 자기 자신과 어긋나기 때문이다 - 그 화면에서
  // 이윤슬이 네 번 나오는데 한 번만 '컴퓨터학부 3학년'이고 나머지 셋은
  // 'ICT융합학부 4학년'이다. ORG-03A에서는 세 번 다 같다. 손으로 그리다 난
  // 사고이지 다른 조직이 아니다.
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '기획부 부서장 이윤슬 컴퓨터학부 3학년 부원 2명 김바다 컴퓨터학부 3학년 박해랑 컴퓨터학부 2학년',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why: 'ORG-03A와 사람이 다르다. 개발용 응답은 하나이고 ORG-03A를 따른다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '홍보부 ＋ 부서장 지정 부원 2명 박해랑 컴퓨터학부 2학년 이윤슬 ICT융합학부 4학년',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why: 'ORG-03A와 사람이 다르다. 개발용 응답은 하나이고 ORG-03A를 따른다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '디자인부 ＋ 부서장 지정 부원 2명 이윤슬 ICT융합학부 4학년 정하늘 컴퓨터학부 3학년',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why: 'ORG-03A와 사람이 다르다. 개발용 응답은 하나이고 ORG-03A를 따른다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '이윤슬 컴퓨터학부 3학년',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 blue-300(#8EC5FF)',
    screen: '화면에 없음',
    why: '기획부의 부서장이 ORG-03A와 다르다. 게다가 이 카드의 이윤슬만 학부·학년이 같은 화면의 다른 세 곳과 어긋난다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '김바다 컴퓨터학부 3학년',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why: 'ORG-03A의 기획부에는 김바다가 없다. 개발용 응답은 ORG-03A를 따른다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '이윤슬',
    kind: '글 없음',
    design: 'gray-800(#1E2939)',
    screen: '화면에 없음',
    why: 'ORG-03A와 기획부의 사람이 다르다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '김바다',
    kind: '글 없음',
    design: 'gray-800(#1E2939)',
    screen: '화면에 없음',
    why: 'ORG-03A와 기획부의 사람이 다르다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '3학년',
    kind: '글 없음',
    design: 'gray-400(#99A1AF)',
    screen: '화면에 없음',
    why: 'ORG-03A와 기획부의 사람이 다르다.',
  },
  // 끌고 있는 한 순간. 디자인은 박해랑 카드가 손에 들려 있는 상태를 함께 그렸다.
  // 가만히 있는 화면에는 그것이 없다 - 그리면 늘 떠 있는 카드가 된다.
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '30:5000 Container',
    kind: '그림 없음',
    design: 'assets/30-5000.svg',
    screen: 'data-asset-node-id를 단 그림이 없음',
    why: '끌고 있는 동안만 있는 카드다. 가만히 있는 화면에 그리면 늘 떠 있게 된다.',
  },
  {
    by: 'place',
    screenId: 'ORG-03B',
    content: '30:5010 Icon',
    kind: '그림 없음',
    design: 'assets/30-5010.svg',
    screen: 'data-asset-node-id를 단 그림이 없음',
    why: '끌고 있는 동안만 있는 카드의 손잡이다.',
  },

  // --- ORG-04: 표의 선과 머리가 다른 화면과 다르게 칠해졌다 -------------------
  //
  // 공용 표(DataTable)는 줄 사이를 gray-50으로, 열 머리를 700으로 그린다.
  // ORG-04만 gray-100·600이다. **공용 부품을 이 화면에 맞추자 FIN-REQ-02가
  // 깨졌다** - 와이어프레임이 화면마다 다르게 칠해진 것이지 규칙이 바뀐 것이
  // 아니다. 그래서 규칙을 따르고 차이를 여기 적는다.
  {
    by: 'color',
    kind: '테두리',
    design: 'gray-100(#F3F4F6)',
    screen: 'gray-50(#F9FAFB)',
    why: '표의 줄 사이 선은 gray-50으로 통일한다(DataTable). ORG-04만 gray-100이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '기능 영역',
    kind: '굵기',
    design: '600',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-04만 600이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '회장단',
    kind: '굵기',
    design: '600',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-04만 600이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '부서장',
    kind: '굵기',
    design: '600',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-04만 600이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '부원',
    kind: '굵기',
    design: '600',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-04만 600이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '기능 영역별 권한',
    kind: '색',
    design: 'gray-700(#364153)',
    screen: 'gray-800(#1E2939)',
    why: '표의 섹션 제목은 gray-800으로 통일한다(DataTable).',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '기능 영역별 권한',
    kind: '굵기',
    design: '600',
    screen: '700',
    why: '표의 섹션 제목은 700으로 통일한다(DataTable).',
  },
  {
    by: 'place',
    screenId: 'ORG-04',
    content: '기능 영역별 권한',
    kind: '배경',
    design: 'gray-50(#F9FAFB)',
    screen: '지정 없음',
    why: '표의 머리줄에는 바탕을 깔지 않는다(DataTable). ORG-04만 회색이다.',
  },
]
