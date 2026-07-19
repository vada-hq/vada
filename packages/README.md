# packages/

웹·(미래)모바일 공유용 **순수 TypeScript 패키지** 전용.

- 허용: Zod 스키마, Hey API 생성 클라이언트, TanStack Query `queryOptions`, 비즈니스 로직·상수
- 금지: TanStack Router 코드(RN 미지원), UI 컴포넌트, 플랫폼 API(DOM·네이티브) 의존 코드
- 공유 패키지는 `react`를 peerDependency로 선언하고, 앱 코드를 역참조하지 않는다.
