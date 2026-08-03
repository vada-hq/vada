# 제품 명세 구조 v1 → v2 마이그레이션

v2는 근거마다 권위·승인 상태·충돌 관계를 명시하고, 충돌 해결 기록을 검증합니다. 제품 의미는 자동 변환하지 않습니다.

## 안전한 절차

1. 기존 승인본을 수정하지 말고 그대로 보존합니다.
2. 새 `draft.json`을 `schemaVersion: 2`, `revision: 0`, `status: review`, `approval: null`로 만듭니다.
3. 각 `sourceEvidence`에 `authority`, `approvalState`, `conflictsWith`를 사람이 확인한 증거에 따라 추가합니다.
4. 충돌한 근거는 `review.resolvedConflicts`에 채택·대체 근거와 영향 항목을 기록합니다.
5. 대기·이력·미상 근거를 승인 규칙의 `origin.sourceRefs`에서 제거하고 질문 또는 참고 근거로만 남깁니다.
6. 검증 통과 후 제품 책임자가 의미를 다시 승인할 때만 최초 또는 후속 승인 리비전을 만듭니다.

## 자동 승격 금지

- `conversation`이라는 이유만으로 `direct_decision`으로 분류하지 않습니다.
- 수정 시각이 최신이라는 이유만으로 `current` 또는 `approved`로 분류하지 않습니다.
- v1 승인본을 v2 승인본으로 기계적으로 바꾸지 않습니다. 출처 재평가 없는 변환은 같은 오류를 보존하기 때문입니다.
