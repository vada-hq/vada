# VADA 화면 프로토타입

Figma Make에서 생성한 VADA 와이어프레임을 실행 가능한 형태로 보존한 참고 앱이다. 실제 제품 프론트엔드는 `apps/web`이며, 이 프로토타입의 화면·권한·데이터 표현은 제품 계약의 원본이 아니다.

## 실행

저장소 루트에서 실행한다.

```bash
pnpm --filter @vada/wireframe dev
pnpm --filter @vada/wireframe build
```

화면에서 발견한 제품 결정은 이 디렉터리에 하드코딩하지 말고 `contracts/`의 새 계약 리비전과 관련 슬라이스에 반영한다. 과거 화면 정의와 QA 자료는 `docs/reference/wireframe/`에 있다.

원본 Figma 프로젝트: https://www.figma.com/design/ulPtLFFmIk2utyBnjtHGBi/VADA-%EC%99%80%EC%9D%B4%EC%96%B4%ED%94%84%EB%A0%88%EC%9E%84-%EC%B0%90%EC%B0%90%EC%B0%90---%EB%B3%B5%EC%82%AC---%EB%B3%B5%EC%82%AC-
