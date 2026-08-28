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
    rule: 'choice-group',
    kind: '굵기',
    design: '700',
    screen: '600',
    why:
      '고르기 묶음의 글은 semibold로 통일한다(components/ChoiceGroup.tsx). ' +
      'ORG-01·ORG-02는 600으로 그려졌는데 OPS-MEET-02만 700이다. ' +
      '선택지를 하나 더 만들 때 무슨 굵기를 줄지 와이어프레임을 열어 보지 않아야 한다.',
  },
  {
    by: 'rule',
    rule: 'choice-group',
    kind: '테두리',
    design: 'blue-500(#2B7FFF)',
    screen: 'blue-400(#51A2FF)',
    why:
      '고른 선택지의 테두리는 톤의 -400으로 통일한다(components/ChoiceGroup.tsx). ' +
      'ORG-01·ORG-02는 -400인데 OPS-MEET-02만 -500이다.',
  },
  {
    by: 'rule',
    rule: 'choice-group',
    kind: '색',
    design: 'blue-700(#1447E6)',
    screen: 'blue-800(#193CB8)',
    why:
      '고른 선택지의 글은 톤의 -800으로 통일한다. ORG-01·ORG-02는 -800인데 ' +
      'OPS-MEET-02만 -700이다. 흔들림이므로 따르지 않는다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '테두리',
    design: 'blue-100(#DBEAFE)',
    screen: 'blue-200(#BEDBFF)',
    why:
      '상태 띠의 테두리는 톤의 -200으로 통일한다(design/tones.ts의 BANNER_TONE). ' +
      '와이어프레임이 흔들린다 — 03A의 파란 띠만 -100이고 09의 붉은 띠는 -200이다. ' +
      '상태가 하나 늘 때 무슨 색을 줄지 규칙만 보고 정할 수 있어야 한다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'red-900(#82181A)',
    screen: 'red-800(#9F0712)',
    why:
      '상태 띠의 제목은 톤의 -800으로 통일한다(design/tones.ts의 BANNER_TEXT). ' +
      '와이어프레임이 흔들린다 — 03A의 파란 띠는 -800인데 09의 붉은 띠만 -900이다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'red-800(#9F0712)',
    screen: 'red-700(#C10007)',
    why:
      '상태 띠의 본문은 톤의 -700으로 통일한다(design/tones.ts의 BANNER_TEXT). ' +
      '와이어프레임이 흔들린다 — 03A의 파란 띠는 -700인데 09의 붉은 띠만 -800이다. ' +
      '06의 노란 띠를 만들 때 와이어프레임을 다시 열지 않으려면 규칙이 하나여야 한다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'green-900(#0D542B)',
    screen: 'green-800(#016630)',
    why:
      '상태 띠의 제목은 톤의 -800으로 통일한다(BANNER_TEXT). 07의 초록 띠만 -900이다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'yellow-900(#733E0A)',
    screen: 'yellow-800(#894B00)',
    why:
      '상태 띠의 제목은 톤의 -800으로 통일한다(BANNER_TEXT). 06A의 노란 띠만 -900이다. ' +
      '붉은 띠(09)·초록 띠(07)와 **같은 흔들림**이라 규칙 쪽이 맞다는 것이 세 번으로 확인됐다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'yellow-800(#894B00)',
    screen: 'yellow-700(#A65F00)',
    why: '상태 띠의 본문은 톤의 -700으로 통일한다(BANNER_TEXT). 06A의 노란 띠만 -800이다.',
  },
  {
    by: 'rule',
    rule: 'state-banner',
    kind: '색',
    design: 'green-800(#016630)',
    screen: 'green-700(#008236)',
    why:
      '상태 띠의 본문은 톤의 -700으로 통일한다(BANNER_TEXT). 07의 초록 띠만 -800이다.',
  },
  {
    by: 'rule',
    rule: 'soft-box',
    kind: '테두리',
    design: 'green-100(#DCFCE7)',
    screen: 'green-200(#B9F8CF)',
    why:
      '옅은 상자의 테두리는 톤의 -200으로 통일한다(SOFT_BOX). ' +
      '07의 확정된 결정 상자만 -100이다.',
  },
  {
    by: 'rule',
    rule: 'soft-box-value',
    kind: '색',
    design: 'green-900(#0D542B)',
    screen: 'green-800(#016630)',
    why:
      '옅은 상자 안의 값은 톤의 -800으로 통일한다(SOFT_BOX_TEXT). ' +
      '07의 결정 글만 -900이다.',
  },
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
    rule: 'value-text',
    kind: '색',
    design: 'green-600(#00A63E)',
    screen: 'green-700(#008236)',
    why:
      '값 타일의 green은 -700으로 통일한다(design/tones.ts의 VALUE_TEXT). ' +
      '와이어프레임이 스스로 갈렸다 — EVT-02D와 MY-REQ-01의 타일은 -700인데 ' +
      '조직 전체 재정(FIN-00)의 실제 지출·증빙 완료만 -600이다. 표를 둘로 가르려 ' +
      '해 봤지만 갈리는 축이 없다(둘 다 같은 모양의 큰 값 타일이다). 규칙이 아니라 ' +
      '흔들림이므로 하나로 두고 여기 적는다.',
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
  // --- 참여 설문: 와이어프레임이 스스로 어긋난 자리 --------------------------
  {
    by: 'place',
    screenId: 'EVT-05',
    content:
      '2026-08-20 10:00 ~',
    kind: '글 없음',
    design: 'gray-700(#364153)',
    screen: '화면에 없음',
    why:
      '두 그림이 같은 조각(event.basics.startAt)을 다르게 그렸다 — EVT-02는 ‘08. 20. (목) 10:00’, EVT-05는 ‘2026-08-20 10:00 ~’이다. 개발용 응답은 하나이고 카탈로그의 예시가 EVT-02 쪽이라 그쪽을 따랐다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05',
    content:
      '행사 기본정보  행사 기본정보에서 자동 반영 행사명 2026 소프트웨어융합대학 체육대회 행사 일시 2026-08-20 10:00 ~ 장소 ERICA 체육관 참가 대상 소프트웨어융합대학 전체 참가비 납부자 무료 / 미납자 5000원 행사 정원 200명 담당자 김바다 문의 카카오톡 채널 @swcollege 행사 기본정보에서 수정',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why:
      '두 그림이 같은 조각(event.basics.startAt)을 다르게 그렸다 — EVT-02는 ‘08. 20. (목) 10:00’, EVT-05는 ‘2026-08-20 10:00 ~’이다. 개발용 응답은 하나이고 카탈로그의 예시가 EVT-02 쪽이라 그쪽을 따랐다. 그 글을 품은 칸도 함께 못 찾는다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05',
    content:
      '행사명 2026 소프트웨어융합대학 체육대회 행사 일시 2026-08-20 10:00 ~ 장소 ERICA 체육관 참가 대상 소프트웨어융합대학 전체 참가비 납부자 무료 / 미납자 5000원 행사 정원 200명 담당자 김바다 문의 카카오톡 채널 @swcollege 행사 기본정보에서 수정',
    kind: '칸 없음',
    design: '배경 지정 없음 / 테두리 gray-100(#F3F4F6)',
    screen: '화면에 없음',
    why:
      '두 그림이 같은 조각(event.basics.startAt)을 다르게 그렸다 — EVT-02는 ‘08. 20. (목) 10:00’, EVT-05는 ‘2026-08-20 10:00 ~’이다. 개발용 응답은 하나이고 카탈로그의 예시가 EVT-02 쪽이라 그쪽을 따랐다. 그 글을 품은 칸도 함께 못 찾는다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05',
    content:
      '25:683 Checkbox',
    kind: '그림 없음',
    design: 'assets/25-683.svg',
    screen: 'data-asset-node-id를 단 그림이 없음',
    why:
      '체크 상자는 그림이 아니라 조작이다. 같은 화면의 다른 체크 상자(25:675)는 그림으로 뽑히지 않았다 — 한 화면 안에서 갈렸으므로 추출의 흔들림이다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05',
    content:
      '25:788 Container:margin',
    kind: '그림 없음',
    design: 'assets/25-788.svg',
    screen: 'data-asset-node-id를 단 그림이 없음',
    why:
      '빈 칸을 감싼 테두리가 그림으로 뽑혔다. 그리는 것이 아니라 칸의 테두리이므로 화면은 클래스로 그린다 — 추출의 흔들림이다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05B',
    content:
      '활성',
    kind: '글 없음',
    design: 'green-700(#008236)',
    screen: '화면에 없음',
    why:
      '두 그림이 같은 설문을 다른 상태로 그렸다 — EVT-05는 초안(gray), EVT-05B는 활성(green)인데 상태 줄도 경로도 둘 다 E-01이다. 개발용 응답은 하나이고 EVT-05가 이 설문의 주 화면이라 그쪽을 따랐다.',
  },
  {
    by: 'place',
    screenId: 'EVT-05B',
    content:
      '활성',
    kind: '칸 없음',
    design: '배경 green-50(#F0FDF4) / 테두리 green-200(#B9F8CF)',
    screen: '화면에 없음',
    why:
      '두 그림이 같은 설문을 다른 상태로 그렸다 — EVT-05는 초안(gray), EVT-05B는 활성(green)인데 상태 줄도 경로도 둘 다 E-01이다. 개발용 응답은 하나이고 EVT-05가 이 설문의 주 화면이라 그쪽을 따랐다.',
  },

  // --- MSG-02: 어휘가 없어 그리지 못한 자리 셋 -------------------------------
  //
  // 색이 틀린 것이 아니라 **명세가 가리킬 말이 없어 화면이 그리지 않는 것**이다.
  // 셋 다 백로그에 어휘 후보로 적혀 있다.
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '행사와 무관한 학생회 내부 소통입니다.',
    kind: '글 없음',
    design: 'gray-400(#99A1AF)',
    screen: '화면에 없음',
    why:
      '고른 선택지의 **부연**이라 담을 자리가 없다. select.helperText는 늘 보이는 글이라 다른 둘에도 붙어 거짓이 되고, options[].description은 static 출처에만 있다. 백로그에 적었다.',
  },
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '아래에서 부서 또는 구성원을 선택해 주세요.',
    kind: '글 없음',
    design: 'gray-400(#99A1AF)',
    screen: '화면에 없음',
    why:
      '고른 것들이 **쌓이는 자리**를 말할 어휘가 없다. list는 itemNoun·addLabel이 필수인데 그림에 둘 다 없고, itemList.selection은 이동이 필수인데 여기서 고른 뒤의 일은 이 화면의 값이 되는 것이다. 백로그에 적었다.',
  },
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '아래에서 부서 또는 구성원을 선택해 주세요.',
    kind: '칸 없음',
    design: '배경 지정 없음 / 테두리 gray-300(#D1D5DC)',
    screen: '화면에 없음',
    why:
      '고른 것들이 **쌓이는 자리**를 말할 어휘가 없다. list는 itemNoun·addLabel이 필수인데 그림에 둘 다 없고, itemList.selection은 이동이 필수인데 여기서 고른 뒤의 일은 이 화면의 값이 되는 것이다. 백로그에 적었다.',
  },
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '학술체육부',
    kind: '글 없음',
    design: 'gray-900(#101828)',
    screen: '화면에 없음',
    why:
      '와이어프레임 두 장이 같은 조직을 다르게 그렸다 — MSG-02는 부서 다섯(학술체육부·기획부·홍보부·재정부·운영부)을, ORG-03A는 셋(기획부·홍보부·디자인부)을 그린다. 개발용 응답은 하나여야 하므로 ORG-03A를 따랐다(ORG-03B와 같은 판정).',
  },
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '구성원 1명',
    kind: '글 없음',
    design: 'gray-400(#99A1AF)',
    screen: '화면에 없음',
    why:
      '와이어프레임 두 장이 같은 조직을 다르게 그렸다 — MSG-02는 부서 다섯(학술체육부·기획부·홍보부·재정부·운영부)을, ORG-03A는 셋(기획부·홍보부·디자인부)을 그린다. 개발용 응답은 하나여야 하므로 ORG-03A를 따랐다(ORG-03B와 같은 판정).',
  },
  {
    by: 'place',
    screenId: 'MSG-02',
    content: '학술체육부 구성원 1명 부서 전체',
    kind: '칸 없음',
    design: '배경 지정 없음 / 테두리 gray-100(#F3F4F6)',
    screen: '화면에 없음',
    why:
      '와이어프레임 두 장이 같은 조직을 다르게 그렸다 — MSG-02는 부서 다섯(학술체육부·기획부·홍보부·재정부·운영부)을, ORG-03A는 셋(기획부·홍보부·디자인부)을 그린다. 개발용 응답은 하나여야 하므로 ORG-03A를 따랐다(ORG-03B와 같은 판정).',
  },

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

  // --- ORG-07A: 표의 머리줄이 또 다르게 칠해졌다 ------------------------------
  //
  // 공용 표의 열 머리는 700이다. FIN-REQ-02는 700, ORG-04는 600, ORG-07A는 500 -
  // **세 화면이 세 굵기다.** 규칙이 바뀐 것이 아니라 손으로 그린 것이 흔들린 것이라
  // 규칙을 따르고 차이를 적는다.
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '이름',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '학번',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '단과대학',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '학부·학과',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '학년',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '학생회비',
    kind: '굵기',
    design: '500',
    screen: '700',
    why: '표의 열 머리는 700으로 통일한다(DataTable). ORG-07A만 500이다.',
  },
  {
    by: 'place',
    screenId: 'ORG-07A',
    content: '이름 학번 단과대학 학부·학과 학년 학생회비',
    kind: '테두리',
    design: 'gray-200(#E5E7EB)',
    screen: 'gray-100(#F3F4F6)',
    why: '표의 머리줄 아래 선은 gray-100으로 통일한다(DataTable).',
  },

  // --- ORG-07B: 같은 범위를 한 화면 안에서 두 가지로 그렸다 ------------------
  //
  // 뒤에 깔린 ORG-07A는 '한양대학교 ERICA › 소프트웨어융합대학 › 컴퓨터학부'로,
  // 모달의 부제는 같은 것을 '·'로 잇는다. **서버는 한 벌만 준다**(org.rosterScope의
  // path). 구분자를 화면이 바꾸면 명세가 모르는 규칙이 하나 생기므로 그대로 쓴다.
  {
    by: 'place',
    screenId: 'ORG-07B',
    content: '한양대학교 ERICA · 소프트웨어융합대학 · 컴퓨터학부',
    kind: '글 없음',
    design: 'gray-400(#99A1AF)',
    screen: '화면에 없음',
    why: '같은 범위를 뒤의 화면은 ›로, 모달은 ·로 그렸다. 서버가 주는 한 벌을 그대로 쓴다.',
  },
  // --- 자리에 건다: 와이어프레임의 일회성 사고 ---------------------------------
  {
    by: 'place',
    screenId: 'OPS-MEET-02',
    content: '*',
    kind: '글 없음',
    design: 'red-500(#FB2C36)',
    screen: '화면에 없음',
    why:
      '읽기 전용 칸은 required가 될 수 없다(input.schema.json: "고칠 수 없으므로 ' +
      'required도 될 수 없다"). 와이어프레임이 주최자에만 필수 별표를 붙였는데 그 ' +
      '칸은 회색이고 값도 서버가 준다. FIN-REQ-01의 요청 부서는 같은 처지에 별표가 ' +
      '없다 — 일회성 사고로 본다.',
  },
  {
    by: 'place',
    screenId: 'OPS-MEET-02',
    content:
      '2 기본 정보 회의의 목적과 책임자를 명확하게 기록합니다. 회의명 * 체육대회 안전 관리 최종 회의 주최자 * 이수현 주관 부서 * 회의 상태 예정 새 회의는 예정 상태로 생성됩니다. 회의 목적 *',
    kind: '칸 없음',
    design: '배경 white(#FFFFFF) / 테두리 gray-200(#E5E7EB)',
    screen: '화면에 없음',
    why: '위와 같은 사고다 — 별표 하나가 빠져 절의 글줄이 통째로 어긋난다.',
  },
]
