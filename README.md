```text
vada-m1/
├─ README.md
├─ apps/
│  ├─ web/                         # 프론트엔드 목표 구조
│  │  ├─ src/
│  │  │  ├─ main.tsx
│  │  │  ├─ App.tsx                # 인증·소속 확인 후 작업 화면 연결
│  │  │  ├─ App.test.tsx
│  │  │  ├─ App.integration.test.tsx # 인증 상태·소속·작업 화면 연결 검증
│  │  │  ├─ App.css
│  │  │  ├─ test-support/
│  │  │  │  ├─ mock-api.ts         # 외부 통신 없는 명시적 API 응답·호출 기록
│  │  │  │  ├─ mock-api.test.ts
│  │  │  │  └─ workflow-fixtures.ts # 통합 테스트용 계정·소속·행사·요청서
│  │  │  ├─ shared/
│  │  │  │  └─ ui/
│  │  │  │     ├─ StateMessage.tsx # 공통 로딩·오류·빈 상태·처리 안내 표시
│  │  │  │     └─ StateMessage.test.tsx
│  │  │  ├─ styles/
│  │  │  │  ├─ tokens.css        # 색상·간격·서체·모서리·레이아웃 공통 값
│  │  │  │  └─ base.css          # 기본 요소·공통 버튼·입력·포커스 스타일
│  │  │  ├─ access/
│  │  │  │  ├─ Memberships.tsx
│  │  │  │  └─ Memberships.test.tsx
│  │  │  ├─ auth/
│  │  │  │  └─ auth-client.ts
│  │  │  ├─ workspace/             # 행사·탭·상세 화면 조합, 이동·복원 상태
│  │  │  │  ├─ Workspace.tsx
│  │  │  │  ├─ EventWorkspace.tsx # 행사 내부 탭·대화·구매요청 화면 조합
│  │  │  │  ├─ Workspace.test.tsx
│  │  │  │  ├─ purchase-workflow.integration.test.tsx # 대화→초안→제출→승인/반려
│  │  │  │  ├─ Workspace.css
│  │  │  │  └─ Sidebar.tsx         # 학생회·내 부서·행사 이동·로그아웃
│  │  │  ├─ chat/
│  │  │  │  ├─ Chat.tsx            # 대화 표시·입력만 담당
│  │  │  │  ├─ Chat.test.tsx
│  │  │  │  ├─ Chat.css
│  │  │  │  └─ useChat.ts
│  │  │  ├─ events/
│  │  │  │  ├─ EventList.tsx
│  │  │  │  ├─ EventList.test.tsx
│  │  │  │  ├─ CreateEventForm.tsx
│  │  │  │  ├─ CreateEventForm.test.tsx
│  │  │  │  ├─ useEvents.ts        # 행사 목록 조회·생성
│  │  │  │  └─ useEvents.test.tsx
│  │  │  └─ purchases/
│  │  │     ├─ Purchases.tsx       # 조회 훅·목록·모달·상세 조합과 이동 보호
│  │  │     ├─ Purchases.test.tsx
│  │  │     ├─ PurchaseList.tsx    # 내 요청·재정부 제출 요청 목록
│  │  │     ├─ PurchaseList.test.tsx
│  │  │     ├─ PurchaseDetail.tsx  # 상세·근거·이력·승인/반려
│  │  │     ├─ PurchaseDetail.test.tsx
│  │  │     ├─ DraftForm.tsx       # 초안 편집·검증·저장/제출/폐기
│  │  │     ├─ DraftForm.test.tsx
│  │  │     ├─ draft-form-model.ts # 입력 검증·합계 계산·저장 데이터 변환
│  │  │     ├─ draft-form-model.test.ts
│  │  │     ├─ FinanceReview.tsx   # 재정부 승인·반려 사유·처리 확인
│  │  │     ├─ LinkDialog.tsx      # 끼룩이 링크 입력·생성 상태
│  │  │     ├─ LinkDialog.test.tsx
│  │  │     ├─ LinkDialog.test-support.ts # jsdom의 네이티브 dialog 대체
│  │  │     ├─ Purchases.css
│  │  │     ├─ purchase-status.ts  # 목록·상세에서 같은 상태 문구 사용
│  │  │     ├─ purchase-test-fixtures.ts
│  │  │     └─ usePurchases.ts     # 요청 조회·생성·저장·상태 변경 통신
│  │  ├─ index.html
│  │  └─ vite.config.ts
│  └─ api/
│     ├─ src/
│     │  ├─ app.ts
│     │  ├─ app.test.ts
│     │  ├─ serve.ts
│     │  ├─ runtime.ts
│     │  ├─ runtime.test.ts
│     │  ├─ web.ts
│     │  ├─ web.test.ts
│     │  ├─ access/
│     │  │  ├─ access.ts
│     │  │  ├─ access.test.ts
│     │  │  └─ membership.ts
│     │  ├─ auth/
│     │  │  ├─ auth.ts
│     │  │  ├─ auth.test.ts
│     │  │  └─ require-session.ts
│     │  ├─ chat/
│     │  │  ├─ chat.ts
│     │  │  └─ chat.test.ts
│     │  ├─ db/
│     │  │  ├─ schema.ts
│     │  │  ├─ schema.test.ts
│     │  │  ├─ purchases.test.ts
│     │  │  ├─ migrate.ts
│     │  │  └─ migrations.test.ts
│     │  ├─ events/
│     │  │  ├─ events.ts
│     │  │  └─ events.test.ts
│     │  └─ purchases/
│     │     ├─ purchases.ts
│     │     ├─ purchases.test.ts
│     │     ├─ service.ts
│     │     ├─ validation.ts
│     │     ├─ generation.ts
│     │     ├─ generation.test.ts
│     │     └─ products.ts
│     ├─ migrations/
│     ├─ scripts/
│     │  ├─ check-draft-live.ts
│     │  ├─ test-data.ts
│     │  ├─ test-data.test.ts
│     │  └─ manage-test-data.ts
│     └─ drizzle.config.ts
├─ docs/
│  └─ ERD.md
└─ packages/
   └─ contracts/
      └─ src/
         └─ index.ts
```
