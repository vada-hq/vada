# 교차 검증: FIN-REQ-02를 명세만 보고 만든다

이 저장소가 세우고 있는 주장은 하나다.

> **명세 하나만 보면 개발자가 화면을 만들 수 있다. 두 산출물을 오가지 않아도 된다.**

그런데 지금까지 **명세를 쓴 것도 구현한 것도 같은 하나**였다. 명세에 안 적고
머릿속에만 갖고 있던 것이 있어도 구현할 때 그냥 써버리니 아무도 모른다. 게이트도 못
잡는다 — 게이트는 명세와 화면을 견주는데 둘 다 같은 손에서 나왔으니 같은 오해를
공유한다.

**이건 검사를 더 만들어서는 못 푼다.** 명세를 안 쓴 쪽이 명세만 보고 만들어 봐야 한다.

## 무엇을 만드나

`FIN-REQ-02`(구매 요청 상세·진행 상태) **화면 하나**.

명세는 이미 있다. 구현만 없다.

- `specs/figma/vada-wireframe/screens/FIN-REQ-02/screen.json` — 이 화면의 동작 명세
- `specs/figma/vada-wireframe/screens/FIN-REQ-02/figma.design.json` — 디자인의 사실
  (노드 트리·색·굵기·자산)
- `specs/figma/vada-wireframe/screens/FIN-REQ-02/reference.png` — 눈으로 볼 그림
- `specs/figma/vada-wireframe/screens/FIN-REQ-02/assets/` — 디자인이 그림으로 뽑아 둔 자리

## 무엇을 보고 만드나

**볼 수 있는 것**

| 무엇 | 어디 |
| --- | --- |
| 명세 번들 전부 | `specs/figma/vada-wireframe/` |
| 계약(스키마·판정기·검증기) | `packages/contracts/` |
| 부품 표 | `apps/vada-web/src/components/` · `apps/vada-web/src/design/` · `apps/vada-web/src/spec/` |
| 이 저장소의 결정 | `docs/decisions/` |
| 와이어프레임 해석 규칙 | `specs/figma/vada-wireframe/interpretation.md` |

**보면 안 되는 것**

- `apps/vada-web/src/screens/` — 이미 만들어 둔 화면 스무 개

같은 종류의 화면(상세 화면·표가 있는 화면)이 그 안에 있고, 그것을 보면 **명세가
말하지 않은 것을 거기서 베끼게 된다.** 그러면 이 실험은 아무것도 재지 못한다.

부품 표를 보여주는 이유는 다르다. 현실의 개발자에게도 디자인 시스템은 이미 있고,
없는 것은 **이 화면**이다.

## 만들 것

1. `apps/vada-web/src/screens/FINREQ02Screen.tsx`
2. `apps/vada-web/src/screens/ScreenRouter.tsx`에 한 줄 등록
3. `apps/vada-web/src/spec/screens.ts`에 명세 import·등록(`ALL_SCREENS`에 넣기)
4. 필요하면 `apps/vada-web/src/spec/types.ts`에 타입 추가
   (이 파일은 스키마를 손으로 옮겨 적은 것이다 — `packages/contracts/schemas/`가 원본)
5. 필요하면 부품(`components/`)을 새로 만들거나 넓히기
6. `apps/vada-web/e2e/`에 이 화면의 시나리오 검사

**개발용 응답(fixtures)은 이미 넣어 뒀다.** `apps/vada-web/src/data-sources/fixtures.ts`의
`finance.purchaseRequestDetail`·`finance.purchaseRequestItems`·`finance.purchaseRequestHistory`.
이건 실험의 대상이 아니라 서버 대역이다 — 현실에서는 백엔드가 준다.

## 채점은 사람이 하지 않는다

이미 있는 게이트가 한다. 넷 다 통과해야 한다.

```
npm test        # 계약 검사 + 화면 검사(준수·design 대조)
npm run validate # 명세 교차 참조
npm run e2e     # 브라우저 시나리오
npm run build
```

게이트가 무엇을 보는지 미리 알아 두면 좋다.

- **준수 검사**(`src/spec/conformance.test.tsx`)는 `ALL_SCREENS`를 훑으므로,
  등록하는 순간 이 화면도 자동으로 채점 대상이 된다. 명세에 적힌 라벨·필수 표시·
  안내 문구·묶음 제목을 화면이 그렸는지 본다.
- **design 대조**(`src/design-check/`)는 `data-node-id`로 등록 노드를 지목하면 그
  안의 **글·글자 색·글자 굵기·칸의 배경색과 테두리색·그림**을 `figma.design.json`과
  견준다. 여백·크기·위치·글자 크기는 보지 않는다(와이어프레임이 0.875배라 잡음이
  섞인다). **화면이 `data-node-id`를 안 달면 "자리 없음"으로 실패한다.**
- **검증기의 역방향 검사**는 design의 상호작용 노드(`Btn`·`Button`·`Text Input`·
  `Dropdown`) 중 등록된 요소 어디에도 없는 것을 오류로 알린다.
- **추출기 래칫**(`tests/screen-draft.test.mjs`)은 이 화면을 이미 세고 있다. 명세를
  고치면 숫자가 움직인다.

## 지켜야 할 것

`docs/decisions/`에 다 있지만 자주 걸리는 것만 옮겨 적는다.

- **명세에 없는 카피를 지어내지 않는다.** 디자인에 없는 라벨·안내 문구를 화면이
  만들어 내면 그것은 명세에 없는 사실이 된다.
- **색을 화면 안에 적지 않는다.** 상태 딱지·톤은 `design/tones.ts`가 한 곳에서 갖는다.
  데이터가 주는 것은 색이 아니라 **톤 이름**이다(`statusTone: 'yellow'`).
- **와이어프레임의 불규칙은 따르지 않는다.** 규칙을 따르고 그래서 생긴 차이는
  `design/deviations.ts`에 적는다. 예외는 자리가 아니라 **규칙·색**에 건다.
- **조용한 대체를 하지 않는다.** 없는 데이터 출처, 등록되지 않은 노드, 인자 없음은
  조용히 넘기지 말고 던지거나 드러낸다.
- 한국어 주석. 무엇을 했는지가 아니라 **왜 그렇게 했는지**를 적는다.

## 이 화면에서 처음인 것

정직하게 미리 말해 둔다. `steps`는 **이번에 새로 만든 요소 유형**이고, 이 화면이
첫 사례다. 그래서 다른 화면에서 베낄 곳이 없다.

- `packages/contracts/schemas/steps.schema.json`에 뜻과 이유가 적혀 있다.
- 지난 단계·지금 단계·앞으로 올 단계를 어떻게 그릴지는 **명세가 정하지 않는다.**
  `figma.design.json`이 말한다.

`summary.eyebrowField`와 `summary.status`도 이번에 생겼다.

## 끝나고 알려 줄 것

통과/실패보다 **막힌 자리**가 이 실험의 산출물이다. 다음을 적어 주면 좋다.

1. **명세만으로 답이 안 나온 것** — 무엇을 추측해야 했나. 어디서 추측했나.
2. **명세가 틀렸거나 어긋난 것** — 명세와 디자인이 다른 말을 하는 자리.
3. **게이트가 잡아 준 것** — 처음에 몇 곳이 어긋났고 무엇이었나.
4. **부품 표에서 모자란 것** — 새로 만들어야 했던 부품과 그 이유.
5. **명세를 이렇게 적었으면 나았겠다** 싶은 것.

**막힌 자리는 실패가 아니라 이 저장소가 찾고 있는 것이다.** 숨기지 말고 적어 달라.
